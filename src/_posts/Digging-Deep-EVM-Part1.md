---
title: 深入理解EVM - Part1 - 初识opcode
date: 2022-06-17 18:39:22
description: 翻译深入理解EVM系列文章，第一篇是关于函数选择器与字节码/opcode
tags: ethereum
categories: 以太坊
---

原文链接：https://noxx.substack.com/p/evm-deep-dives-the-path-to-shadowy?s=r
译者博客:  [Alvan的Blog](alvan.coffee)


aaaaaaaa
### Digging deep into the EVM mechanics during contract function calls



第一性原理我们经常听说，就是着重于理解事物的基本概念从而更好地理解构建与其之上的组件。

在智能合约的世界里，EVM和它的算法与数据结构就是第一性原理，
我们写的智能合约就是建立在其之上的组件。要想成为一个优秀的solidity开发，必须要对EVM有深刻了解。

这系列文章的第一要义就是深入理解EVM，构建成为“shadowy super coder”的基础知识。

## The Basics: Solidity → Bytecode → Opcode 

开始之前，本文嘉定读者是掌握了solidity的基本用法以及怎么部署到以太坊的，后边只会简单提到，如果你想复习一下这部分知识的话请看[这篇文章](https://medium.com/@eiki1212/explaining-ethereum-contract-abi-evm-bytecode-6afa6e917c3b)。

solidity在部署到以太坊网络之前是需要被编译成字节码的，这些字节码又和一系列opcode匹配，这些opcode可以被EVM解释。

这一个系列会着眼于编译后字节码的特定部分并阐释他们的工作机制。在每一篇文章的结尾，你都可以对这些函数更清晰的认知。一路下来，你会学到有关EVM的许多概念。 

今天我们就看一个基础的solidity合约，从它的字节码/opcode片段里解释一下EVM是怎么选择函数的。

solidity创造的运行时字节码对应着一整个合约，合约部署之后，其中可能存在多个可以被调用的函数。这里边一个基础问题是EVM怎么根据合约调用的函数知道执行哪些字节码。

### 1_Storage.sol Breakdown 

在demo里我们使用了一个Storage.sol的合约，这是remix生成的默认合约之一。

![img](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F3400bba6-f870-4b68-8ba8-118562b08aef_489x538.png)

在这个合约里有两个函数，store(uint256) 和 retrieve() ，当函数调用的时候EVM就必须进行区分，下边就是此合约编译出的字节码。

```
608060405234801561001057600080fd5b50600436106100365760003560e01c80632e64cec11461003b5780636057361d14610059575b600080fd5b610043610075565b60405161005091906100d9565b60405180910390f35b61007360048036

0381019061006e919061009d565b61007e565b005b60008054905090565b8060008190555050565b60008135905061009781610103565b92915050565b6000602082840312156100b3576100b26100fe565b5b60006100c184828501610088565b

91505092915050565b6100d3816100f4565b82525050565b60006020820190506100ee60008301846100ca565b92915050565b6000819050919050565b600080fd5b61010c816100f4565b811461011757600080fd5b5056fea264697066735822

1220404e37f487a89a932dca5e77faaf6ca2de3b991f93d230604b1b8daaef64766264736f6c63430008070033 
```

我们看一下下面的片段，这个片段就是函数选择器的逻辑，可以用ctrl + f 验证一下它是否在上述字节码中。

```
60003560e01c80632e64cec11461003b5780636057361d1461005957
```

这段字节码对应一系列的opcode与其输入值，你可以在[这里](https://www.ethervm.io/)查看EVM的opcode列表。opcode的长度为1个字节也就是最多支持256种opcode，现在EVM已使用140种。

下边展示了字节码所对应的opcode，它们会在EVM的调用战(call stack)中逐条执行。比如你可以从上边的链接里找到字节码 60 代表着opcode PUSH1等等。在这篇文章的结尾，你会对它们有一个全面的认知。

```
60 00                       =   PUSH1 0x00 
35                          =   CALLDATALOAD
60 e0                       =   PUSH1 0xe0
1c                          =   SHR
80                          =   DUP1  
63 2e64cec1                 =   PUSH4 0x2e64cec1
14                          =   EQ
61 003b                     =   PUSH2 0x003b
57                          =   JUMPI
80                          =   DUP1 
63 6057361d                 =   PUSH4 0x6057361d     
14                          =   EQ
61 0059                     =   PUSH2 0x0059
57                          =   JUMPI  
```

### Smart Contract Function Calls & Calldata

在深挖opcode之前需要快速过一遍我们究竟是怎么调用函数的。当我们调用一个合约函数时，需要包含有函数签名和所需参数的calldata。可以在solidity里完成:

![img](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Fa9957ce1-945b-4afa-a395-c9d2563d2094_1614x670.png)

这里我们调用了合约的store函数，参数为10。我们使用abi.encodeWithSignature()获得calldata，emit会记录用于测试的calldata。

```
0x6057361d000000000000000000000000000000000000000000000000000000000000000a
```

上边就是abi.encodeWithSignature("store(uint256)", 10) 返回的字节码

之前提到了函数签名，现在我们再明确一下：

> 函数签名就是函数规范化表示的Keccak Hash的前四个字节。

函数标准化表示其实就是函数名+参数类型，就像 “store(uint256)” 和 “retrieve()”。你可以在[这里](https://emn178.github.io/online-tools/keccak_256.html)验证一下store(uint256)的hash。

```
keccak256(“store(uint256)”) →  first 4 bytes = 6057361d

keccak256(“retrieve()”) → first 4 bytes = 2e64cec1
```

我们可以看到calldata有36个字节，前四字节对应着我们刚刚计算出来的 store(uint256) 函数签名，剩下的32个字节对应着传入的uint256参数，一个16进制的a，也就是10进制的10.

```
6057361d = function signature (4 bytes)

000000000000000000000000000000000000000000000000000000000000000a = uint256 input (32 bytes)
```

我们获得了函数选择器 6057361d，你可以ctrf + f去opcode那一段确认一下。

### Opcodes & The Call Stack

现在关于EVM的函数选择器的前置知识已经学完了，现在正式开始。首先要过一遍每一个opcode和它们对调用栈的操作。如果你不熟悉栈的话可以看一下这个[视频](https://www.youtube.com/watch?v=FNZ5o9S9prU)。

PUSH1代表着把下一个字节(0x00也就是十进制0)的数据压入调用栈中，下一个opcode我们可以知道这么做的理由。

![img](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F52e45eff-44b3-4028-a075-9f5591fd2e7e_900x151.png)

接下来用CALLDATALOAD弹出栈顶元素stack(0)作为该命令的输入值。

这个opcode要把calldata载入调用栈，而输入值(也就是上边弹出的值)是偏移量(offset)，我们设为i。栈元素是32字节，而calldata是36字节，要压入的数据就是msg.data[i:i+32] (译者注:msg.data就是完整的calldata)，这既保证了只有32字节压栈，又允许我们访问calldata的任何一部分。

在这种情况下，我们并没有偏移量，因为offset = 0x00，所以我们把calldata前32字节压栈。之前我们记录过整个的call data为“0x6057361d000000000000000000000000000000000000000000000000000000000000000a”。这意味着我们丢失了后边四个字节(“0000000a”)，如果我们想访问这个uint256变量则需要使用4字节的偏移量，忽视前四字节的函数签名，而得到完整的变量。

![img](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Fe6f79343-c4c4-4ee6-a29f-f1923fea5b9e_901x150.png)

这次又有一个PUSH1，它想压一个0xe0，也就是十进制224。224是这么来的: 函数签名有4字节或者说32位，载入的calldata有32字节256位，256 - 32 = 224。

![img](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F161dea9b-d35b-4eb1-aac5-7adecb6cc17d_901x149.png)

下一步，SHR操作意味着右移一位，而栈顶弹出的224则是移位次数，栈的下一个元素0x6057361d0…0a便是执行移位操作的主题。现在我们可以在调用栈里看到4字节的函数选择器了。如果你不了解移位操作的话请看这个[视频](https://youtu.be/fDKUq38H2jk?t=176)。

![img](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F8db5bd19-2271-44b3-99ed-0eec2731be5c_893x144.png)

下一个是DUP1，一个复制栈顶元素的简单操作。

![img](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F40b72e9d-6e80-4232-9099-8718604542a8_896x146.png)

PUSH4压入了 retrieve()的4字节函数签名(2e64cec1)，你可能疑惑evm是怎么知道这个值的，请记住字节码由solidity编译而来，它有函数名和参数类型等所有信息。

![img](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F23dc9994-e360-4205-bf5d-af92aaba42e5_899x189.png)

EQ 操作会弹出两个元素去判断是否相等，在这里0x2e64cec1 != 0x6057361d ，如果他们相等则压1，不相等则压0。

![img](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F7cfc3f88-d5eb-4b03-b4c3-eb605bdeb283_895x144.png)

PUSH2压入两字节的 0x003b 也就是十进制59。

调用栈有一个称为程序计数器的东西，它会确认字节码下一个要执行的指令在哪里，现在我们设置59是因为这是 retrieve() 函数的起始位置是59。(看下边EVM Playground 部分可以清楚这里具体是怎么实现的)。你可以看到程序字节码定位方式类似solidity代码行数，如果这个函数在59行声明，你可以使用行数来告诉机器怎么找到这个函数。

![img](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F67596d4e-054d-4cd7-b516-64b4789ee01f_900x190.png)

JUMPI 表示 “jump if” ，它会弹出两个值作为参数，59表示跳转地址而第二个元素作为布尔值代表是否跳转。

如果真值为true，程序计数器将更新然后执行跳转到指定位置，而在我们这个例子里真值为false，程序计数器并没有改变，程序继续顺序执行。

![img](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F1357763b-4150-4e14-8a8c-583ee74572aa_896x146.png)

再次DUP1

![img](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F40b72e9d-6e80-4232-9099-8718604542a8_896x146.png)

PUSH4把store(uint256) (0x6057361d)压栈

![img](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Ff937657d-dbb3-4133-95bb-1b3f5b8117cd_897x188.png)

EQ判断，此次为真

![img](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F9c0617f7-2181-427e-9dca-917be7847f0a_898x145.png)

PUSH2把 store(uint256) 的定位0x0059也就是89压栈

![img](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F44dea0e0-9e0c-4459-bd1e-4af814c89203_898x186.png)

JUMPI，这次执行跳转了，程序计数器更新为89然后到字节码的其他部分运行去了。在目的地会有一个JUMPDEST，如果目的地没有这个opcode，跳转将会失败。( 译者注: 我们可以在两个函数跳转的目的地可以找到JUMPDEST的字节码 5b )

![img](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F9f3a7f3c-a5f6-4e29-888f-60708e8863dc_896x146.png)

我们可以到store(uint156)的字节码处依照此法继续执行了。虽然这个合约只有2个函数，但是原理和20+函数的合约是一样的。你现在知道EVM如何基于函数调用找到函数的字节码了，这其实就是对合约里所有函数的位址进行if-else判断实现的。

### EVM Playground

我强烈建议大家看看[这个](https://www.evm.codes/playground),这是一个EVM运行环境，你可以设置字节码然后在上边执行。在这里可以看到调用栈的变化，我也添加了JUMPDEST，所以你也可以看到JUMPI后发生了什么

![img](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F86591a6b-ee71-4590-8462-4ebb38f5cb80_1503x887.png)

这个EVM运行环境也可以帮你理解程序计数器，在这份代码里，可以看到每个命令的注释，其偏移量代表程序计数器标记的位置。

你也可以看到Run按钮左边的calldata输入，去试试把它改成retrieve()  0x2e64cec1看看有什么变化吧！只需要点击Run然后step into按钮(就是那个弯箭头)，一步一步运行opcode。



本系列下一节我们会研究一下内存 [EVM Deep Dives - Part 2](https://noxx.substack.com/p/evm-deep-dives-the-path-to-shadowy-d6b?s=r)。