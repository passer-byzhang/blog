---
title: 深入理解EVM - Part3 - 存储区
date: 2022-06-22 18:36:49
description: 合约存储区相关知识，SSTORE和SLOAD
tags: ethereum
categories: 以太坊
---

原文链接：https://noxx.substack.com/p/evm-deep-dives-the-path-to-shadowy-3ea?s=
译者：[Alvan's Blog](alvan.coffe)

这是“深入理解EVM”系列的第三篇文章，需要[第一篇](https://noxx.substack.com/p/evm-deep-dives-the-path-to-shadowy?utm_source=url&s=r) 和[第二篇](https://noxx.substack.com/p/evm-deep-dives-the-path-to-shadowy-d6b?s=r)的前置知识，因此如果您没读过的话建议先读一下。在这一篇里，我们会仔细研究合约存储区是怎么工作的，提供一些有助于理解插槽包装(slot packing)的思维方式，如果对装填插槽很陌生也不必担心，插槽包装的知识对EVM的骇客们至关重要，你也可以在本文结束时深刻了解它。

如果你玩过[Ethernaut Solidity Wargame Series](https://ethernaut.openzeppelin.com/) 或者其他Solidity的CTF赛事，就会知道装填插槽的知识经常是解决难题的关键。(译者注: CTF全称Capture The Flag，中文名夺旗赛，一般指网络安全领域的技术竞赛)。

## 基础知识

在[“Program the Blockchain”](https://programtheblockchain.com/posts/2018/03/09/understanding-ethereum-smart-contract-storage/) 里对合约存储基础知识有一个相当完整的概述，我将回顾一下这篇文章里的关键知识点，当然也很推荐看一下这个全文。

### 数据结构

我们先从合约存储的数据结构说起，这是我们理解其他知识的坚实基础。

合约存储就是一个简单的 k-v map结构。32字节的key，32字节的value。key有32字节让我们可以拿到0到(2^256)-1的key值。

所有的value都会初始化为0，0不会显式写入。还挺有道理的，可观测宇宙里也是有 2^256 个原子。没有计算机能存储这个多的数据。存储区 value 置 0 返还gas，因为节点不用存储这些数据了。

你可以把存储区视为一个宇宙级的大数组，二进制 0 对应的 key 代表数组的第 0 个元素，二进制1对应的 key 代表数组的第一个元素，以此类推。

[![img](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F13728261-0af4-4581-b03f-04057bdbb5dc_744x370.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F13728261-0af4-4581-b03f-04057bdbb5dc_744x370.png)

## 定长变量

声明为存储(storage)的的合约变量分为两种，定长变量和不定长变量。我们着重研究一下前者，看看EVM是怎么把定长便利那个装进32字节的插槽里的。关于不定长变量可以看一下[“Program the Blockchain”](https://programtheblockchain.com/posts/2018/03/09/understanding-ethereum-smart-contract-storage/) 这篇文章。

现在我们知道存储区是一个map，那么下一个问题就是怎么给key分配value。假设我们有以下代码。

[![img](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F211a6f5d-9a81-41b9-9643-e31c141d0827_335x298.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F211a6f5d-9a81-41b9-9643-e31c141d0827_335x298.png)

给定的变量都是定长的，EVM可以从 0 开始挨个装填，装完 0 装 1，装完 1 装 2，以此类推。排列顺序基于合约里变量声明的顺序，第一个被声明的变量会在0插槽。在这个例子里插槽0存储  value1，value2 是一个长度为 2 的数组，所以存在插槽1 和插槽2，value3 存储在插槽3，如下图所示：

[![img](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F46352903-1395-49d0-a3a8-36b1bf5a3000_744x288.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F46352903-1395-49d0-a3a8-36b1bf5a3000_744x288.png)

现在我们看一个类似的合约，猜下是怎么存的。

[![img](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F48a5cb06-c390-4b92-8a20-39053f40d54c_335x316.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F48a5cb06-c390-4b92-8a20-39053f40d54c_335x316.png)注意变量类型不是 uint256

根据上一个例子你可能猜测我们会占用 0 到 3 插槽，因为有4个变量。但其实这个例子只占用了插槽0。这是变量类型不同造成的，之前我们用的都是 uint256 类型也就是32字节，在这里我们用的是 uint32，uint64 和 uint128，分别代表4字节，8字节和16字节的数据。

这就是插槽包装一词的由来。Solidity编译器知道一个插槽能装 32字节的数据， uint32 value1 装填在插槽0里只占用了4字节，等读到下一个可以装填的变量时，就会装进这个插槽。

(译者注：不知道你记不记得上一篇文章里有一个无法写入的0值插槽，它和插槽0是两个不同的东西，前者英文写作 zero slot，后者是 slot[0]，具体可见官方文档)

根据上边的例子我们开始从插槽0开始装填：

- value1 装进插槽0，占用4字节
- 插槽0剩余28字节
- value2长4字节，小于等于28，装进插槽0
- 插槽0剩余24字节
- value3长8字节，小于等于24，装进插槽0
- 插槽0剩余16字节
- value4长16字节，小于等于16，装进插槽0
- 插槽0剩余0字节

> *注意uint8是solidity的最小类型，因此包装不能小于1字节(8位)*

下图展示了插槽0里存放的共32字节的4个变量。

[![img](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Fdeb707da-60db-465d-a7c2-e45befefe3ff_744x434.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Fdeb707da-60db-465d-a7c2-e45befefe3ff_744x434.png)

## EVM Storage Opcodes

了解了存储区数据结构和插槽包装的原理只有我们看两个相关的opcode，SSTORE 和 SLOAD。

### SSTORE

SSTORE 从调用栈取两个值，一个是32字节的 key，一个是32字节的 value。然后把 value 存在 key 值对应的插槽上，可以在[这里](https://www.evm.codes/playground?unit=Wei&codeType=Mnemonic&code='z1uFFv1 0w~z2uy8965w'~\nz%2F%2F Example yv2 w~SSTORE~v~PUSHuy0xFFuvwyz~_)看到他是怎么工作的。

```
//Example 1
PUSH2 0xFFFF
PUSH1 0
SSTORE

//Example 2
PUSH2 0xFF
PUSH2 8965
SSTORE
```

### SLOAD

SLOAD 从调用栈拿32字节的 key 值，然后把 key 值插槽的 value 拿出来压到调用栈上，可以在[这里](https://www.evm.codes/playground?unit=Wei&codeType=Mnemonic&code='wSet up thrstatez46z0~SSTOREy1z0vy2z1v~'~\nz~PUSH1 y~~wExamplrw%2F%2F v~SLOADre rvwyz~_)看到他是怎么工作的。

```
// Set up the state
PUSH1 46
PUSH1 0
SSTORE

// Example 1
PUSH1 0
SLOAD

//Example 2
PUSH1 1
SLOAD

```

这时候你就要问了，如果 SSTORE 和 SLOAD 都是处理32字节的数据，那不足32字节被包装进插槽的怎么办呢？那上边的例子来说，我们 SLOAD 插槽0之后，拿到32字节数据，里边有 value1 到 value4 四个变量，EVM怎么知道要返回什么呢？SSTORE 也有同样的问题，如果我们每次都写32字节，那怎么确保 value2 不会覆盖 value1 呢，怎么确保 value3 不会覆盖 value2 呢？接下来我们将找出答案：

## 存取被包装(slot packing)的变量

下边是一个仿照上个例子的合约，加上了一个方法，功能是存储然后读一个值去做算术操作。

[![img](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F53bfa82f-b889-40c8-a407-3157f2e31385_457x452.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F53bfa82f-b889-40c8-a407-3157f2e31385_457x452.png)

这个store()函数将会执行上边那些我们有疑问的操作：在不覆盖原有数据的情况下，将多个变量写进同一插槽，以及从插槽的32字节数据中取出我们想要的那个变量。

让我们看一看执行结束后，插槽0的最终状态，牢记十六进制数被机器识别为二进制码，它会在slot packing中作为位运算的操作数。

[![img](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F3ce409fd-b942-42d7-b7ea-02c18c4a8993_782x338.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F3ce409fd-b942-42d7-b7ea-02c18c4a8993_782x338.png)

记下 0x115c 为十进制 444，0x14d 为十进制 333，0x16 为十进制 22，0x01为十进制 1，与代码里的赋值相符，一个插槽持有 4 个变量。

### 位运算

Slot packing使用 AND，OR 和 NOT 三个位运算，对应 EVM 的 opcode 与之同名。让我们快速过一遍。

#### AND

下看下边的两个 8 位二进制数，AND 操作第一个数的第一位和第二个数的第一位，如果都是 1 的话结果的第一位就是 1 。否则为 0。之后算两个操作数的第二位，以此类推。

[![img](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F50496d7f-3e74-404c-b71c-472cf2440c2c_466x302.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F50496d7f-3e74-404c-b71c-472cf2440c2c_466x302.png)

#### OR

OR就是两个操作数中，每位只要有一个 1 值，结果的对应位就是 1，否则为 0。

[![img](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F42a806e1-3da7-4a11-901d-47d40a85ba3f_466x302.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F42a806e1-3da7-4a11-901d-47d40a85ba3f_466x302.png)

#### NOT

NOT 有些不一样，因为他只有一个操作数，效果就是对着每一位取反。

[![img](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Fed511be0-14bd-4f0e-adf5-e464e8cd7b4d_466x276.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Fed511be0-14bd-4f0e-adf5-e464e8cd7b4d_466x276.png)

现在看看他们是怎么应用于上边solidity例子里的。

### 插槽操作：存储包装变量SSTORE

看一下solidity代码第18行

```
value2 = 22;
```

在这时 value1 已经存进插槽0了，现在我们需要pack一些额外数据放进这个插槽。value3 和 value4 存储的时候也是一样的逻辑。我们来看一下理论上是怎么做的，也会提供一个EVM playground强化理解。

我们从以下变量开始讲起

[![img](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F4fdcbc53-b6a6-4d10-892e-ff2d3b159f53_778x244.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F4fdcbc53-b6a6-4d10-892e-ff2d3b159f53_778x244.png)

注意0xffffffff 是二进制 11111111111111111111111111111111。

EVM干的第一件事就是用 EXP ，输入一个基数一个指数返回计算结果。我们现在使用 0x100 作为基数，代表一个字节的偏移量，之后指数为 0x04，代表 value2 的起始位置。下图展示了这个返回值的作用：



[![img](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Ff33571de-7414-4e29-9681-d2f9f5693550_1058x284.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Ff33571de-7414-4e29-9681-d2f9f5693550_1058x284.png)

我们得到了EXP函数的返回值，现在可以把0x16写在正确的位置上，即4字节的位置。
(译者注：0x100 的 0x04 次幂，算出来是2 ^ 8，也就是0x100000000，插槽从右往左装填，相当于从右到左偏移八位)

我们现在还不能写进去，因为已经存储的 value1 会被覆盖，这时候掩码就发挥作用了。

[![img](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F71f004c0-6d1d-40b9-a83c-3355832e3138_1058x706.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F71f004c0-6d1d-40b9-a83c-3355832e3138_1058x706.png)

上图展示了掩码是怎么发挥作用的，怎么拿数据可以把待写入那个区域单独无视，其他部分正常提取。在这个情况下 value2 想占用的区域已经都置零了，如果没置零，我们将看到数据被清除。

(译者注：掩码的原理很简单，就是用AND命令制造一个某区域为0，其它区域数值不变的方法，比如给定一个数 0x1010，我想把从左到右第三位隐藏，那么我可以制造一个数 0x1101，即待隐藏位置为 0 其它为 1，那么由于 0 和任何数and都是0，1 和任何数and结果都与该数一致，用0x1101 AND 0x1010，我们得到了一个0x1000，第三位被抹去了，其它位数不变。用在这里就是为了抹去对应位的原值)

这有另一个例子是我们把4个变量全部存进去的情况下把 value2 值从 22 改成 99。看到0x016 值被清除了。

[![img](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F5c1522f7-9467-4116-9c3a-a076d0bc0fcd_1058x414.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F5c1522f7-9467-4116-9c3a-a076d0bc0fcd_1058x414.png)

你可能正在想 OR 是怎么用上的，这张图会展示下一个步骤：

[![img](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Fb9ff9609-0488-4684-848b-5d4245b0d966_1058x880.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Fb9ff9609-0488-4684-848b-5d4245b0d966_1058x880.png)

(译者注：就是把第一步计算的“只有 value2”的32字节数据与第二步计算的“隐藏了value2位置的32位数据”做OR操作，即可得到最终结果)

我们现在可以把包含 value1 和 value2 的 32字节数据写入插槽0了，他们都在正确的位置。

### 插槽操作：取出被包装的变量SLOAD

关于提取我们看一下solidity带么的22行

```
uint96 value5 = value3 + uint32(666)
```

我们只关心 value3 是怎么拿出来的，对它的算术计算不感兴趣。下面就是取出 value3 需要的数据，跟上边的不太一样。

[![img](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Fc8dffd1d-bcd2-461d-90c7-97287d7f0d2e_1148x204.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Fc8dffd1d-bcd2-461d-90c7-97287d7f0d2e_1148x204.png)

经过了一些修改，他们将会用于检索。

[![img](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Ff55711ab-e05f-46a3-9291-c472409a7276_1058x672.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Ff55711ab-e05f-46a3-9291-c472409a7276_1058x672.png)

我们现在从插槽0 里提取出了 value3，0x14d也就是十进制 333，跟solidity里看到的一样。
(译者注：就是和存储反过来了，先取出slot，再根据除法把待取一直右移到插槽最低位，最后用掩码把其它数据匿藏)

再次使用掩码和位操作和以帮助我们从32字节的插槽里准确提取数据，现在它放在栈上，可以执行 “value3 + uint32(666)” 了。

## EVM Playground

这是store()的所有opcode了，你可以把它放在 [EVM playground](https://www.evm.codes/playground)里跑一跑交互一下，会有一个直观的感受，可以看到调用栈和合约存储在你一步一步执行的时候是怎么变化的。

```
// --------------------------------
// Solidity Line 17 - "value1 = 1;"
// --------------------------------

PUSH1 0x01
PUSH1 0x00
DUP1
PUSH2 0x0100
EXP
DUP2
SLOAD
DUP2
PUSH4 0xffffffff
MUL
NOT
AND
SWAP1
DUP4
PUSH4 0xffffffff
AND
MUL
OR
SWAP1
SSTORE
POP

// ---------------------------------
// Solidity Line 18 - "value2 = 22;"
// ---------------------------------


PUSH1 0x16 // value2 = 22 decimal = 0x16 in hex

PUSH1 0x00 // slot 0 - storage location for "value2"

PUSH1 0x04 // 4 bytes in - start position for "value2"

PUSH2 0x0100 // 0x100 in hex = 256 in decimal, 256 bits in 1 byte 

EXP // exponent of 0x0100 & 0x04 = 0x100000000       
    
DUP2 // duplicate 0x00 to top of stack

SLOAD // load data at slot 0

DUP2 // duplicate exponent of 0x0100 & 0x04 = 0x100000000

PUSH4 0xffffffff // bitmask 4 bytes length      

MUL // multiply to get bitmask for the 8 bytes assigned to "value2"

NOT // NOT operation to get bitmask for all bytes except the 8 bytes assigned to "value2"

AND // AND of bitmask and slot 0 value to zero out values in the 8 bytes assigned to "value2" and retain all other values

SWAP1 // bring 0x100000000 to top of the stack

DUP4 // duplicate value2 value = 22 = 0x16

PUSH4 0xffffffff // bitmask 4 bytes length 

AND // AND to ensure the value is no more than 4 bytes in length

MUL // returns value2 at the correct position - 4 bytes in

OR // OR with previous value and the value AND yielded on line 38 gives us the 32 bytes that need to be stored

SWAP1 // slot 0 to top of the stack

SSTORE // store the 32 byte value at slot 0

POP // pop 0x16 off the stack

// ----------------------------------
// Solidity Line 19 - "value3 = 333;"
// ----------------------------------

PUSH2 0x014d
PUSH1 0x00
PUSH1 0x08
PUSH2 0x0100
EXP
DUP2
SLOAD
DUP2
PUSH8 0xffffffffffffffff
MUL
NOT
AND
SWAP1
DUP4
PUSH8 0xffffffffffffffff
AND
MUL
OR
SWAP1
SSTORE
POP

// -----------------------------------
// Solidity Line 20 - "value4 = 4444;"
// -----------------------------------

PUSH2 0x115c
PUSH1 0x00
PUSH1 0x10
PUSH2 0x0100
EXP
DUP2
SLOAD
DUP2
PUSH16 0xffffffffffffffffffffffffffffffff
MUL
NOT
AND
SWAP1
DUP4
PUSH16 0xffffffffffffffffffffffffffffffff
AND
MUL
OR
SWAP1
SSTORE
POP

// ----------------------------------------------------------
// Solidity Line 22 - "uint64 value5 = value3 + uint32(666);"
// ----------------------------------------------------------


PUSH1 0x00

PUSH2 0x029a // uint32(666)

PUSH4 0xffffffff // bitmask 4 bytes length

AND // ensure uint32(666) does not exceed 8 bytes, trim if it does 

PUSH1 0x00 // slot 0 - location of value3

PUSH1 0x08 // 8 bytes in - start position for "value3"

SWAP1 // bring 0x00 to top of stack for SLOAD of slot 0

SLOAD // load data at slot 0

SWAP1 // bring 0x08 to top of stack for EXP

PUSH2 0x0100 // 256 bits in 1 byte 

EXP // exponent of 0x0100 & 0x08 = 0x10000000000000000

SWAP1 // get slot 0 value to top of stack

DIV // DIV of slot 0 value with 0x10000000000000000 remove bottom 8 bytes  

PUSH8 0xffffffffffffffff // bitmask 8 bytes length 

AND // Zero out bytes outside of the 8 byte mask to return variable "value3"

// To see the rest of the opcodes for this calculation recreate the contract in remix and enter debugging mode
```

在我们文章里提到的两个部分(solidity18行和22行)写了注释，强烈建议把这份代码拍一遍加深理解。

[![img](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F2f0f0e5d-fd10-41d6-ad63-aa2b719f98d5_1497x847.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F2f0f0e5d-fd10-41d6-ad63-aa2b719f98d5_1497x847.png)

你现在应该对存储插槽的工作原理和EVM存取插槽内特定位置数据有一定了解了，尽管SLOAD 和 SSTORE 两个opcode只能操作32字节数据，但是我们可以使用掩码和位运算存取想要的数据。

在这个系列的[第四篇](https://noxx.substack.com/p/evm-deep-dives-the-path-to-shadowy-5a5?s=r)，我们会学习Geth是怎么实现 SSTORE 和 SLOAD 操作码的。

希望对您有帮助！