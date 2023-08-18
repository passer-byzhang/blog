---
title: 基于bls12-381生成秘密随机点
date: 2022-07-05 13:39:11
mathjax: true
tags:
- Rust
- 密码学
categories: 
- 密码学
description: 一个多方协同计算生成椭圆曲线上的秘密点的思路与实现，可以应用于随机数，身份验证等等
---


## 背景

作者在搬groth16上链的项目里需要用到一些椭圆曲线上的秘密随机点(自然也可以把它当作root生成随机数)，需要用到MPC计算生成。记录一下算法和思路，加密部分使用bls12-381加密库。

## 概述

因为在Groth16中需要使用到一系列的随机点进行掩藏数据，产生这些随机数的参数绝不能泄漏，比如bls12-381上的一个$\alpha$点来源$g_1\times a$，由于陷门函数的特性，我们无法通过$\alpha$来推导出$a$，但是一旦$a$遭到泄漏，就可以直接计算出$\alpha$。

那么我们就需要一种在运算过程中不可能泄露$a$的方法去生成$\alpha$，这就可以转换成一个多方协同计算的问题：

假设有n个参与生成计算的节点参与，它们会依次提供$a_1，a_2，a_3...a_n$这n个随机数计算出$\alpha_1，\alpha_2...\alpha_n$，如果先计算$a$再进行隐藏：$\alpha=(\prod_{i=1}^n a_i)\times g_1$，那么$a$和传输过程中的$a_i$都有可能泄露。

要将中间变量加密变成$E(\prod_{i=1}^n a_i)$和$E(a_i)$，才能在运行过程中不泄漏任何一个人提供的信息$a_i$，就可以保证每一个参与提供随机数的节点都不可能的知道最终的$a$，所有人拿到的只有加密后中间值。

## 基本思路

可以预见的一点就是在依次计算的过程中，我们需要防止有人作恶，篡改之前的结果。如果第3个节点收到了加密数据$E(a_1\times a_2)$，但是它传给下一个人的却是$E(a_3\times a_3 \times a_3)$——擅自修改了内容，我们需要如何验证呢？

如果我们没有使用加密数据$E(a_1\times a_2)$和$E(a_3\times a_3 \times a_3)$，而是直接存储了$a_1\times a_2$，接受第三个节点的$a_3\times a_3 \times a_3$和他自己的$a_3$，那么我们只需要验证上一次的结果$a_1\times a_2$与新节点提供的随机数$a_3$乘积是否等于它传给下一个人的$a_3\times a_3 \times a_3$，就可以了。

但是**所有人拿到的只有加密后中间值**，我们只要保证中间值的运算结果符合数字运算的规律，也就是“同态”即可。

**如果加密函数E(x)满足以下特性,则认为有同态性**
$$ 加法同态:E(a+b)=E(a)+E(b)  \\ 乘法同态:E(ka)=kE(a) \\双线性映射:假设有两个群G_1,G_2,G_1*G_1=G_2,g是G_1的生成元,e(g,g)是G_2的生成元,则
e(g^a,g^b)=e(g,g)^{ab}=e(g^b,g^a)$$

我们的bls12-381中也符条件，既
加法同态：$(a_1+a_2)\times g_1 = a_1\times g_1 + a_2\times g_1$
乘法同态：$k \times (a_1\times g_1) = (k\times a_1)\times g_1$

双线性映射：$pairing(a_1\times g_1 , a_2\times g_2) = pairing((a_1\times a_2)\times g_1，g_2)$

## 实现方法

我使用双线性映射来进行验证，第i个节点传输的数据为：

```rust
#[derive(Clone, Copy)]
pub struct ParameterPair<E: Engine> {
    pub g1_result: Option<E::G1Affine>,//传给下一个节点的数据,g1上的点,既(a1*a2*..ai * g1)
    pub g2_result: Option<E::G2Affine>,//传给下一个节点的数据,g2上的点,既(a1*a2*..ai * g2)
    pub g1_mine: Option<E::G1Affine>,//该节点新加入的数据,g1上的点,既(ai * g1)
    pub g2_mine: Option<E::G2Affine>,//该节点新加入的数据,g1上的点,既(ai * g2)
}
```

验证端保存着之前$i-1$个节点传输数据的列表：

```rust
Vec<ParameterPair<E>>;
```

需要通过这个列表 的最新数据和节点自己的随机数更新信息：

```rust
pub fn mpc_common_paramters_custom<E>(
    paramter_last: &ParameterPair<E>,
    num: E::Fr,
) -> Result<ParameterPair<E>, SynthesisError>
where
    E: Engine,
    E::G1: WnafGroup,
    E::G2: WnafGroup,
{
    let g1 = E::G1::generator();
    let g2 = E::G2::generator();//g1,g2是两个群上的元，类似于自然数中的1。
    let g1_before = paramter_last.g1_result.unwrap();//之前列表的最新值：a1*a2*...a(n-1) * g1
    let g1_after = (g1_before * num).to_affine();//预期中更新之后的值：a1*a2*...a(n-1)*a(n) * g1
    let g2_before = paramter_last.g2_result.unwrap();
    let g2_after = (g2_before * num).to_affine();
    let g1_mine = (g1 * num).to_affine();//a(n)*g1
    let g2_mine = (g2 * num).to_affine();//a(n)*g2
    let result = ParameterPair {
        g1_result: Some(g1_after),
        g2_result: Some(g2_after),
        g1_mine: Some(g1_mine),
        g2_mine: Some(g2_mine),
    };
    return Ok(result);
}
```

在新增数据之前，可以通过该列表和新节点传入数据验证：

```rust
pub fn verify_mpc_g1<E>(new_paramter: &ParameterPair<E>, paramters: &Vec<ParameterPair<E>>) -> bool
where
    E: Engine,
    E::G1: WnafGroup,
    E::G2: WnafGroup,
{
  	/**
  	*g1,g2是两个群上的元，类似于自然数中的1。
  	*/
    let g1 = E::G1::generator();
    let g2 = E::G2::generator();
  	/**
  	*这一步验证传来的结构体里g1,g2上的点是一一对应而非假造的，验证方法为：
		* pairing(g1_mine, g2)== E::pairing(g1, g2_mine);
		* pairing(g1_result, g2)== E::pairing(g1, g2_result);
  	*/
    let mut result = E::pairing(&new_paramter.g1_mine.unwrap(), &g2.to_affine())
        == E::pairing(&g1.to_affine(), &new_paramter.g2_mine.unwrap());
  	result = E::pairing(&new_paramter.g1_result.unwrap(), &g2.to_affine())
        == E::pairing(&g1.to_affine(), &new_paramter.g2_result.unwrap());
    let index = paramters.len();
		/**
		* 这一步用来验证第i个节点是否篡改了原来的数据：拿出一个进故宫验证的节点i-1的数据list[i-1]
		* 那么应该有：pairing(list[i-1].g1_result,new_paramter.g2_mine)==pairing(new_paramter.g1_result,g2)
		*/
    if (index >= 1) {
        let paramter_last = new_paramter.g1_result.unwrap();
        let paramter_part2 = new_paramter.g2_mine.unwrap();
        let paramter_part1 = paramters[index - 1].g1_result.unwrap();
        result = result
            && E::pairing(&paramter_last, &g2.to_affine())
                == E::pairing(&paramter_part1, &paramter_part2);
    }
    result
}
```

如果验证通过，再将该节点的信息加入进列表，进行下一轮计算。

最后拿到的g1_result和g2_result就是$(\prod_{i=1}^n a_i)\times g_1$和$(\prod_{i=1}^n a_i)\times g_2$了，这同时我们确实没有泄露任何一个$a$，也避免了作恶。

## 一些总结和延伸

大家应该可以看出这个实例也可以用同态加法或乘法来做，比如每个人传$a_i\times g_1$，然后维护一个$(a_1+a_2+...+a_i)\times g_1$来使用和验证即可。或者说任何一个同态加密方法都可以依照此法进行多方计算。

同态加密也可以用于验证信息，比如同一组信息分成几个碎片，通过这吸热碎片验证这个集体对某物的所有权，我们可以通过同态加密计算，每一个人的私钥碎片是$k_1,k_2...k_n$，私钥为$K=(\prod_{i=1}^n k_i)$如何在不互通私钥信息的情况下一起生成一个私钥呢？可以把每一个私钥同态隐藏起来$E(k_i)$，计算$E(\prod_{i=1}^n k_i) = \prod_{i=1}^n E(k_i)$来进行验证。

感谢您的观看，作者也是刚刚接触，如有错漏请诸君斧正。

[作者博客: alvan.coffee](alvan.coffee)