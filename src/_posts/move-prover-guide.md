---
title: Move Prover 入门
date: 2022-09-18 21:25:12
tags: 
- Move
- Aptos
categories: Aptos
mathjax: true
description: 翻译自一个关于Move Prover的入门教程
---

![The Move Prover: A Practical Guide](https://osec.io/blog/assets/posts/move-prover/move-prover-title.png)

*形式化验证* - 一种验证程序正确性的强力工具。但它是如何工作的呢？这篇博客会介绍一些Move Prover的使用技巧，充分利用其潜力，并探讨如何在一个实际例子中使用形式化验证去保证合约安全。

从上层看，形式化验证可以为程序提供规范，程序的符号输入会根据规范进行校验，并要求证明所有可能的输入都符合该规范。

## Move Prover

Move Prover是一个对Move语言智能合约形式化验证的自动化工具。

Move在设计上就是便于自动化验证的，更有趣的是Move Prover也是操作MoveVM的字节码本身，这就避免了潜在的编译器错误影响证明程序的正确性。

Move Prover由多个组件构成，如下图所示：

![Move Prover arch](https://i.imgur.com/ti4vkTu.png)

首先，Move Prover 接收一个Move源文件作为输入，该文件中需要设置程序输入规范。之后 Move Parser 会在源码中把规范提取出来。Move 编译器将源文件编译为字节码，和规范系统(specification)共同转化为验证者对象模型(Prover Object Model)。

这个模型会被翻译成一种名为[Boogie](https://www.microsoft.com/en-us/research/project/boogie-an-intermediate-verification-language/)的中间语言。这段 Boogie 代码会被传入 Boogie 验证系统，该系统对输入进行“验证条件生成”([verification condition generation](https://en.wikipedia.org/wiki/Verification_condition_generator))。该验证条件(VC)会被传入一个名为 Z3 的自动理论验证器([automated theorem prove](https://en.wikipedia.org/wiki/Automated_theorem_proving))中。

VC 被传进 Z3 程序后，该验证器会检查 SMT公式 是否是不可满足的。如果是这样，这意味着规范是成立的。否则，将生成一个满足条件的模型，并将其转换回Boogie格式，以便发布诊断报告。然后将诊断报告还原为与标准编译器错误类似的源码级错误。

*译者注：SMT是形式语言与自动机的相关知识，有兴趣的读者可以搜索 SAT 与 SMT 进一步了解，大致意思就是SMT/SAT是一个公式，可满足性是指是否存在一组输入使其为真。*

## Move Specification Language 

MSL是Move语言的子集，它引入了对静态描述有关程序正确性的行为的支持，而不影响生产。

为了更好地理解使用MSL的方法，我们将使用[Pontem’s U256 library](https://github.com/pontem-network/u256)作为教学案例，这是一个实现U256的Move开源库。

U256是由一个包含4个u64的结构体实现的。

```rust
struct U256 has copy, drop, store {
    v0: u64,
    v1: u64,
    v2: u64,
    v3: u64,
}
```

现在我们聚焦到函数`add(a: U256, b: U256): U256`上。为了保证这样一个函数的正确性，验证一些群论的公理可能会有用处，比如交换律和结合律。

规范(specifications)被声明在“规范代码块”(specification block，下均称spec代码块)中，它可能在Move Module的函数中，也可能作为一个单独的规范module文件。

例如，如果你的文件是`sources/u256.move`,那你可以把规范放在`sources/u256.spec.move`里。

```
spec add { ... }
```

放置在spec代码块中的规范被视为*表达式*。

## 表达式

我们先看一些通用表达式吧。

`aborts_if`定义了函数应该何时终止(abort)。这在智能合约开发中非常有用，在合约里一个abort就可以导致整个交易回滚。

举个例子：当且仅当U256加法溢出的时候`add`函数abort。让我们把这句话变成表达式：

```rust
const P64: u128 = 0x10000000000000000;

spec fun value_of_U256(a: U256): num {
    a.v0 + 
    a.v1 * P64 + 
    a.v2 * P64 * P64 + 
    a.v3 * P64 * P64 * P64
}

spec add {
    aborts_if value_of_U256(a) + value_of_U256(b) >= P64 * P64 * P64 * P64;
}
```

我们在上边的代码片段中可以看到在spec代码块中可以调用函数。但是被调用者必须是一个MSL函数或者一个纯Move函数。纯Move函数就是不修改全局变量或者其使用的语句和特性均被MSL支持。

 `aborts_if` 的一个常见写法是 `aborts_if false`，它可以让一个函数验证永不abort。

```move
spec critical_function {
    aborts_if false;
}
```

另一个我们经常使用的表达式是 `ensures`，顾名思义，就是保证在函数运行的结尾确认一个状态。

在`add`函数的例子里我们希望确认返回值是两个参数之和。⚠️注意，因为MSL使用无界数，我们可以清楚这个表达式是不会溢出的。

```
spec add {
    aborts_if value_of_U256(a) + value_of_U256(b) >= P64 * P64 * P64 * P64;
    ensures value_of_U256(result) == value_of_U256(a) + value_of_U256(b);
}
```

因为Move规范函数是用MSL写的，所以在这里不存在溢出风险。

让我们试着用上面的规范来验证这个库：

```
$ move prove
```

报出以下错误信息：

```
[...]

error: abort not covered by any of the `aborts_if` clauses
╭     spec add { 
|         aborts_if value_of_U256(a) + value_of_U256(b) >= P64 * P64 * P64 * P64;
|         ensures value_of_U256(result) == value_of_U256(a) + value_of_U256(b);
|     }
╰─────^

[...]

 at ./sources/u256.move:316: add
 enter loop, variable(s) carry, i, ret havocked and reassigned
     carry = 54
     i = 3792
     ret = u256.U256{v0 = 26418, v1 = 27938, v2 = 6900, v3 = 1999}
 at ./sources/u256.move:346: add
     ABORTED
     
FAILURE proving 1 modules from package `u256` in 9.143s
{
    "Error": "Move Prover failed: exiting with verification errors"
}

```

验证器说这个abort没有被abort_if覆盖到所以验证失败了，但是我们明明已经做到了全覆盖不是吗？

让我们继续看错误信息，会遇到一个意义不明的信息：`ret havocked and reassigned`.

这是什么意思？

深入理解Move Prover源码后，我们找到了一个[可能性怀疑](https://github.com/move-language/move/blob/e0dafc5cf3efe4c4e61411f10cdf0f379a36673c/language/move-prover/bytecode/src/loop_analysis.rs#L94)。验证器试图用归纳法证明所有的循环！

严格来说，它会把循环分解为两个关键步骤，遵循经典的归纳法证明

1.基本情况：对循环开始时的循环不变量进行断言
2.归纳：假设不变量，执行循环体，并断言不变量成立

*译者注：此处和下面的 不变量，均为 invariant 和 invariants 的翻译，与 const常量 不同，不变量 并不是一个值，而代表一个状态，例如在某个循环中，a 永远小于 b，那么 a < b 是一个 循环不变量，其他 不变量 也类似。*

循环证明程序还会把循环内的所有变量破坏和随机赋值。回到日志消息，这意味着变量` carry`， ` ret`和 `i `已经被破坏，或被分配了随机值。这也解释了为什么`add`的输入输出不灵了。

更具体地说，循环分析转换为以下步骤：

1. 断言循环不变量
2. 破坏所有修改过的变量
3. 假设循环不变量
4. 假设循环保护(while条件里的代码)
5. 执行循环体
6. 断言循环不变量

这里有两种处理循环的解决方案

第一个是指定循环不变量。

为了指定循环不变量我们需要用到一些特殊的语法，在[之前的一篇文章里](https://osec.io/blog/tutorials/2022-09-06-move-introduction/)简单介绍过。

```rust
  while ({
      spec {
          invariant len(amounts_times_coins) == i;
          invariant i <= n_coins;
          invariant forall j in 0..i: amounts_times_coins[j] == input[j] * n_coins;
      };
      (i < n_coins)
  }) {
      vector::push_back(
          &mut amounts_times_coins,
          (*vector::borrow(&input, (i as u64)) as u128) * (n_coins as u128)
      );
      i = i + 1;
  };
```

在这个例子里，括号中指明了`while` 循环中的循环不变量，请注意，由于循环不变量实在循环保护之后执行的，所以我们需要一个额外的步骤`i <= n_coins`。

```move
  while ({
      spec {
          invariant len(amounts_times_coins) == i;
          invariant i <= n_coins;
          invariant forall j in 0..i: amounts_times_coins[j] == input[j] * n_coins;
      };
      (i < n_coins)
  }) {
```

循环不变量通常情况下很难写，尤其是重要循环体

第二个处理循环的解决方案是展开循环。这种技术在某些特定情况下是有效的，就如我们所看到那样，`add`函数内的循环恰好循环4次。

```rust
/// Total words in `U256` (64 * 4 = 256).
const WORDS: u64 = 4;

[...]

let i = 0;
while (i < WORDS) {
    let a1 = get(&a, i);
    let b1 = get(&b, i);

[...]
```

展开这个函数再跑一次，Move Prover会打印出成功信息：

```
SUCCESS proving 1 modules from package `u256` in 9.685s
{
    "Result": "Success"
}
```

为了确保**交换律**(`a+(b+c) = (a+b)+c`) 成立，改变加数的分组不改变加法结果。为了验证该项，我们首先写一个模拟该属性的函数：

```
fun add_assoc_property(a: U256, b: U256, c: U256): bool {
    let result_1 = add(b, c); 
    let result_11 = add(a, result_1); 
    let result_2 = add(a, b); 
    let result_22 = add(c, result_2); 

    let cmp = compare(&result_11, &result_22); 
    if ( cmp == EQUAL ) true else false
}
```

然后再创建一个spec代码块来规范溢出话函数结果：

```
spec add_assoc_property {
    aborts_if (value_of_U256(a) + value_of_U256(b)) + value_of_U256(c) >= P64 * P64 * P64 * P64;
    ensures result == true;
}
```

运行Move Prover的新规范吗我们可以确认这里没有验证错误：

```
SUCCESS proving 1 modules from package `u256` in 9.685s
{
    "Result": "Success"
}
```

如果余姚进一步了解Move Prover语法，建议阅读Move仓库中的[spec-lang.md](https://github.com/move-language/move/blob/main/language/move-prover/doc/user/spec-lang.md) 完整文档。

## 用例

 形式化验证可以证明智能合约满足所有可能情况下的给定需求，甚至不需要运行该合约。困难的是制定规范。在这里，我们希望探索一些验证思想的实际例子。

### 错误条件


以`std::fixed_point32`为例，显式定义函数何时可能中止通常是有用的。例如具有定点数的算术运算只有在溢出时才会出错。

```move
      spec schema MultiplyAbortsIf {
          val: num;
          multiplier: FixedPoint32;
          aborts_if spec_multiply_u64(val, multiplier) > MAX_U64 with EMULTIPLICATION;
      }
      spec fun spec_multiply_u64(val: num, multiplier: FixedPoint32): num {
          (val * multiplier.value) >> 32
      }
```

### 访问控制策略

与错误条件类似，在规范中强制显式访问控制策略通常很有用。

例如，在`std::offer` 中，我们可以看到，当且仅当不存在offer时或者接收者不被允许时，函数应该abort。

```move
    spec redeem {
      /// Aborts if there is no offer under `offer_address` or if the account
      /// cannot redeem the offer.
      /// Ensures that the offered struct under `offer_address` is removed.
      aborts_if !exists<Offer<Offered>>(offer_address);
      aborts_if !is_allowed_recipient<Offered>(offer_address, signer::address_of(account));
      ensures !exists<Offer<Offered>>(offer_address);
      ensures result == old(global<Offer<Offered>>(offer_address).offered);
    }
```

这些访问控制规范使得以后不会意外删除关键访问控制策略。

### 复杂的数学公式

无论是十进制实现还是更复杂的数据结构，验证"期望的输出"恒等于"输出"通常是有用的。

证明基本数据结构完全按照预期工作将使您对代码库的其余部分更有信心。

例如，在我们与[Laminar Markets](https://laminar.markets/)的合作中，我们提供了针对更简单的优先级队列数据结构验证其内部扩展树实现的建议。

### 数据不变量

形式化验证提供了验证某些“变量”或“资源”没有超出预期边界的最佳环境。让我们从下面考虑结构。我们可以使用`struct invariant`确保` index `永远不大于4。

```rust
struct Type {
    index: u64
}

spec Type {
    invariant index < 4;
}
```

 我们最近对[LayerZero](https://layerzero.network/)和[Aries Markets](http://ariesmarkets.xyz/)的审计中验证更复杂的属性，细节留给读者练习。

### 经济不变量

设计恰当的经济不变量需要更高的创造力，但可以非常有效地保护您的协议。

举个例子，您不能通过增加和减少股权从池子里提走代币，在实践中，您可以将其作为工具帮助函数实现。

```move
  // #[test] // TODO: cannot specify the test-only functions
  fun no_free_money_theorem(coin1_in: u64, coin2_in: u64): (u64, u64) acquires Pool {
      let share = add_liquidity(coin1_in, coin2_in);
      remove_liquidity(share)
  }
  spec no_free_money_theorem {
      pragma verify=false;
      ensures result_1 <= coin1_in;
      ensures result_2 <= coin2_in;
  }
```

这里有一些中心思想：

1. 通过 AMM 进行 swap 操作永远不会在池的一边没减少的情况下令另一边增加。换句话说，no free money。
2. 在一系列的存贷取款指令之后，贷款协议应该始终是完全抵押的。
3. 在下单后取消订单后，订单簿不应该赔钱。

## 结语

 在这篇文章中，我们探讨了如何正确地利用Move验证器来验证代码库中的关键不变量。

 在我们接下来的文章中，我们将探索如何通过学习问正确的问题，将Move验证器变成压制安全漏洞的利器，所以请继续关注!

我们热衷于形式化验证，并将Move安全的可能性推向极致。如果您有任何想法或者想深入了解审计，请随时联系我[@notdeghost](https://twitter.com/notdeghost/)。

## 原文链接

https://osec.io/blog/tutorials/2022-09-16-move-prover/