---
title: 深入理解EVM - Part 5 - 调用/委托调用的原理与实现
date: 2022-06-30 23:28:36
description: 从solidity使用，到opcode原理，再到Geth实现，三个层次解读委托调用的原理与实现
tags: ethereum
categories: 以太坊
---

原文链接：https://noxx.substack.com/p/evm-deep-dives-the-path-to-shadowy-a5f
译者：[Alvan's Blog](alvan.coffee)

# 深入理解EVM - Part 5 - 调用/委托调用



今天我们详细解读一下 CALL 和 DELEGATECALL 两个操作，如果没看过[第二篇](https://noxx.substack.com/p/evm-deep-dives-the-path-to-shadowy-d6b?utm_source=%2Fprofile%2F80455042-noxx&utm_medium=reader2&s=r)，[第三篇](https://noxx.substack.com/p/evm-deep-dives-the-path-to-shadowy-3ea?utm_source=%2Fprofile%2F80455042-noxx&utm_medium=reader2&s=r) 和[第四篇](https://noxx.substack.com/p/evm-deep-dives-the-path-to-shadowy-5a5?utm_source=%2Fprofile%2F80455042-noxx&utm_medium=reader2&s=r)的话，建议作为前置知识读一下。

我们将从solidity，EVM 和 Geth 三个层面解读这两个opcode，让你对它们有一个全面的认识。然而在深入理解他们之前，我们先确认一下合约执行上下文的概念：

### 执行上下文

*当EVM运行合约时，会创造一个[上下文](https://www.evm.codes/about)，它包含以下几个部分：*

- Code
  - 存储在链上的合约的不可变代码。
- Call Stack
  - 前文讲过的合约的调用栈，EVM运行合约时会初始化一个空的。
- Memory
  - 合约的内存，EVM运行合约时会初始化一个空的。
- Storage
  - 存储区在执行过程中持久化，链上存储，根据合约地址和插槽寻址。
- The Call Data
  - 交易的传入数据
- The Return Data
  - 合约调用的返回数据

在阅读下面内容时，时刻记着这几个点。我们先从[Smart Contract Programmer](https://www.youtube.com/watch?v=uawCDnxFJ-0)的DELEGATECALL使用用例开始讲：

### Solidity 样例

下图是同一个合约中的两个调用，一个使用了DELEGATECALL，另一个使用了CALL。现在我们看一下他们之间的区别。

[![img](https://substackcdn.com/image/fetch/w_2400,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Fbd68e45d-6238-483a-bf8f-393db30ac39c_2650x1572.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Fbd68e45d-6238-483a-bf8f-393db30ac39c_2650x1572.png)

下边是这次交互的一些信息(如果你在remix里自己执行的话，会是不一样的数据)：

我们有两个合约，即 Contract A 和 Contract B 还有一个 EOA：

- EOA 地址 = 0x5B38Da6a701c568545dCfcB03FcB875f56beddC4
- Contract A 地址 = 0x7b96aF9Bd211cBf6BA5b0dd53aa61Dc5806b6AcE
- Contract B 地址 = 0x3328358128832A260C76A4141e19E2A943CD4B6D

现在把 Contract B 的地址和一个uint值 12以及 1000000000000000000 Wei 传入，调用 Contract A 里的两个方法， setVarsDelegateCall 和 setVarsCall。

***Delegate Call***

1. 一个 EOA 地址把 Contract B 的地址和一个uint值 12以及 1000000000000000000 Wei 传入，调用Contract A的setVarsDelegateCall，这次是委托调用Contract B执行setVars(uint256)，参数是12。
2. 委托调用运行 Contract B 的 setVars(uint256) 但是更新的是 Contract A 的存储区，它运行时的存储区，msg.sender 和msg.value 也都和父调用一样。
3. Contract A的存储区写入数据：num=12，sender = EOA Address以及value = 1000000000000000000。尽管Contract A 调用的setVars(uint256)不带value，

执行完这个方法之后我们检查Contract A 和Contract B的num， sender 和 value状态。我们可以看到Contract B没有被初始化，都设置在Contract A里了。

***Call***

1. 一个 EOA 地址把 Contract B 的地址和一个uint值 12以及 1000000000000000000 Wei 传入，调用 Contract A 的setVarsCall，这次是调用Contract B执行setVars(uint256)，参数是12。
2. 调用运行 Contract B 的setVars(uint256) ，不改变(本合约的)存储区，msg.sender,和msg.value
3. Contract B的存储区写入数据：num=12，sender = Contract A Address 以及value = 0。(1000000000000000000 Wei被传进了父调用setVarsCall。)

执行完这个方法之后我们检查Contract A 和Contract B的num， sender 和 value状态。我们可以看到Contract A没有被初始化，都设置在Contract B里了。

“委托调用”就是允许你从别的合约里复制一个方法粘贴到你的合约里，运行起来就行在你的合约里执行的一样，使用本合约的存储区，msg.sender 和 msg.value。而“调用”是进入到另一个合约去执行方法，相当于发了一笔交易，有其自己的value值和sender(也就是调用call的合约)。

### Delegate Call & Storage Layout委托调用与内存布局

在上述例子里，你肯呢个注意到Contract B 第5行的注释*“NOTE: storage layout must be the same as contract A”*。

合约里的每一个函数都会经过编译成为一个静态的字节码。当我们理解solidity变量的时候，是看见num，sender和value去理解的。但是字节码不知道这些，它只认存储插槽，而声明变量的时候就把插槽定下来了。

Contract B 的 setVars(uint256) 函数里，“num = _num”就是说要把 _num 存进插槽0。当我们看一个DELEGATECALL的时候不要去想num → num，sender → sender的映射，因为在字节码的层面不是这样的，我们需要认识到这是slot 0 → slot 0, slot 1 → slot 1的映射。

[![img](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Fcf64c77b-f60f-4720-96bb-575dabef8917_1006x306.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2Fcf64c77b-f60f-4720-96bb-575dabef8917_1006x306.png)

试想如果我们改变了声明变量的顺序会怎样。那么他们的插槽位置会改变，同时setVars(uint256) 的字节码也跟着变了。如果我们把 Contract B 的6行和8行互换位置，先声明 value 后声明 num 。那就意味着11行的“num = _num”意味着把 _num存进插槽2里，13行的“value = msg.value”意味着把msg.value 存进插槽0。这就用意味着两合约中，我们变量之间的映射和插槽之间的映射不匹配了

[![img](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F0f24b3ce-a2ed-4bbe-b87d-6d36b9148640_1006x306.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F0f24b3ce-a2ed-4bbe-b87d-6d36b9148640_1006x306.png)

在这种情况下，当我们运行 DELEGATECALL 时，num变量会被存在插槽2，而这里在 Contract A 中映射到 value 变量。反过来也是一样的，两个变量就会存储进预想之外的地方。这就是DELEGATECALL比较危险的原因之一。我们意外地 value 值把 num 覆盖了，用 num 值把 value 覆盖了。但是黑客可不会意外，他们会有目的地攻击。

试想我们知道一个开放 delegatecall 的合约，我们知道那个合约存储 owner的插槽。现在我们可以做一个相同布局的合约，然后写一个更新owner的方法，这就意味着我们可以通过委托调用这个更新方法来改变该合约的owner。

如果你对这个黑客攻击感兴趣的话可以在这里深入了解一下：

- [Ethernaut Level 6 - Delegation](https://ethernaut.openzeppelin.com/level/0x9451961b7Aea1Df57bc20CC68D72f662241b5493)
- [Ethernaut Level 16 - Preservation](https://ethernaut.openzeppelin.com/level/0x97E982a15FbB1C28F6B8ee971BEc15C78b3d263F)

下面看一看opcode层面

## Opcodes

我们现在知道DELEGATECALL怎么工作了，那么深入一下，看看DELEGATECALL和CALL的操作码。

对于DELEGATECALL我们有以下输入变量

- `gas`: 执行的gas费
- `address`: 执行上下文的account
- `argsOffset`: 输入数据(calldata)的偏移量
- `argsSize`: calldata的大小
- `retOffset`: 输出数据(returndata)的偏移量
- `retSize`: returndata的大小

CALL比起上边的只多一个value，其它的都一样

- `value`: 发送给account的以太币(CALL only)

委托调用不需要value输入，它从父调用继承。我们的执行上下文有和父调用一样的存储区，msg.sender 和 msg.value。

他们都是有一个返回值布尔值"success"，为0则为执行失败，反之则为1。

> *如果调用位置没有合约或者没有代码，Delegatecall会返回true。这会出现bug，因为它没执行，我们是希望返回False的*

### DELEGATECALL Opcode Inspection With Remix利用Remix检验DELEGATECALL

下边是Remix中调用DELEGATECALL操作码的截图。对应Solidity代码的24-26行。

我们可以看到栈和内存的条目以及它们是怎么传进DELEGATECALL的。

[![img](https://substackcdn.com/image/fetch/w_5760,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F39945796-94b6-4d6b-8bf6-52b29ac22559_3404x1334.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F39945796-94b6-4d6b-8bf6-52b29ac22559_3404x1334.png)

我们按照这条路线理解：opcode → stack → memory → calldata

1. Solidity代码的24行，使用了delegatecall 调用 Contract B 的 setVars(unit256)，调用了DELEGATECALL操作码。
2. DELEGATECALL从栈上拿6个输入：
   1. Gas = 0x45eb
   2. Address = 0x3328358128832A260C76A4141e19E2A943CD4B6D (Address for Contract B)
   3. ArgsOffset = 0xc4
   4. ArgsSize = 0x24
   5. RetOffset = 0xc4
   6. RetSize = 0x00
3. 注意到 argsOffset 和 argsSize 两个代表了传入 Contract B 的 calldata。这两个变量让我们从内存位置0xc4开始，复制后边的 0x24 (十进制36)作为calldata。
4. 我们因此拿到了0x6466414b000000000000000000000000000000000000000000000000000000000000000c，6466414b是setVars(uint256) 的函数签名，而000000000000000000000000000000000000000000000000000000000000000c是我们传入的数据 12。
5. 这对应了Solidity代码的25行，abi.encodeWithSignature("setVars(uint256)", _num)。

因为setVars(uint256)不返回任何值，所以retSize置0。

如果有返回值的话，就是存在retOffset以后的retOffset以内。这应该让你对这个操作码的底层逻辑了解的深一点，也会和Solidity联系起来了。

现在我们看一下Geth里的实现。

### Geth实现

我们看一下Geth里写DELEGATECALL的部分。目标是展现DELEGATECALL和CALL在存储的层面的区别，以及是怎么联系上SLOAD的。

下边的图有点唬人，但是我们拆解开来一步一步做，在结束的时候你就会对DELEGATECALL和CALL有深刻的认识。

[![img](https://substackcdn.com/image/fetch/w_5760,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F60abd9bd-475f-4694-8bce-aa4c4b43fadd_4102x3874.png)](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F60abd9bd-475f-4694-8bce-aa4c4b43fadd_4102x3874.png)

We have the DELEGATECALL & CALL opcodes labeled on the left-hand side and the SLOAD opcode labeled bottom right. Let’s see how they’re connected.

1. 这图里有两个 [1] 号截图，分别对应DELEGATECALL和CALL操作码的代码，在[instructions.go](https://github.com/ethereum/go-ethereum/blob/d4d288e3f1cebb183fce9137829a76ddf7c6d12a/core/vm/instructions.go)里。我们可以看到从栈里弹出的那几个变量，之后可以看到调用 interpreter.evm.DeleagteCall和 interpreter.evm.Call 这两个函数，传进去了栈里的变量，目标地址和现在的合约上下文
2. 图里也有两个 [2] 号截图，分别对应 evm.DelegateCall 和 evm.Call 的代码的代码，在 [evm.go](https://github.com/ethereum/go-ethereum/blob/d4d288e3f1cebb183fce9137829a76ddf7c6d12a/core/vm/evm.go)里边。中间省略了一些校验和其它函数，我们主要关注执行调用NewContract方法新建上下文的代码，其它的可以忽略掉。
3. 图里有两个 [3] 号截图。里边主要是evm.DelegateCall和evm.Call 调用NewContract。它们非常相似，以下两点除外：
   1. DelegateCall的value参数设为nil，它从之前的上下文继承，所以不写进这个参数里。
   2. NewContract的第二个参数也不一样。evm.DelegateCall 里caller.Address( ) 用的是Contract A的地址。evm.Call 里addrCopy是复制的toAddr，也就是Contract B的地址，这一点区别非常大。他俩都是AccountRef类型，这个很重要，后边会提到。
4. DelegateCall’s的NewContract会返回一个Contract结构体。它又调用了AsDelegate()方法(在[contract.go](https://github.com/ethereum/go-ethereum/blob/d4d288e3f1cebb183fce9137829a76ddf7c6d12a/core/vm/contract.go)里)(见图[4])，把msg.sender 和 msg.value设置成了父调用的样子，也就是EOA地址和1000000000000000000 Wei。这在Call的实现里是没有的。
5. evm.DelegateCall 和 evm.Call 都执行NewContract方法(在[contract.go](https://github.com/ethereum/go-ethereum/blob/d4d288e3f1cebb183fce9137829a76ddf7c6d12a/core/vm/contract.go)里)，NewContract方法的第二个入参是“object ContractRef”，对应着第三点里提到的AccountRef。
6. “object ContractRef”和一些其他值被用来初始化合约，对应Contract结构体里的“self”
7. Contract结构体( 在[contract.go](https://github.com/ethereum/go-ethereum/blob/d4d288e3f1cebb183fce9137829a76ddf7c6d12a/core/vm/contract.go)里)有一个“self”字段，你可以看到也有其他的字段与我们之前提到的执行上下文有关。
8. 现在我们跳跃一下，去看看Geth里SLOAD(在[instructions.go](https://github.com/ethereum/go-ethereum/blob/d4d288e3f1cebb183fce9137829a76ddf7c6d12a/core/vm/instructions.go)里)的实现，它在调用GetState时用的参数就是scope.Contract.Address( )。这里的“Contract”就是我们在第7条提到的结构体。
9. Contract结构体的Address( ) 返回的是self.Address。
10. Self是一个ContractRef类型，ContractRef必然有一个Address( ) 方法。
11. ContractRef是一个接口，规定如果一个类型要做ContractRef，那必须有一个返回值类型是common.Address的Address( ) 函数。common.Address是一个长度20的字节数组，也就是以太坊地址的长度。
12. 我们回到第3块看一下evm.DelegateCall和evm.Call 中AccountRef的区别。我们可以看到AccountRef就是一个有Address( ) 函数的地址，那它也符合ContractRef接口的规则。
13. AccountRef 的 Address( ) 函数是把 AccountRef 转化成common.Address，也就是 evm.DelegateCall 里的 Contract A 地址和 evm.Call 里的Contract B 地址。这意味着第8部分讲的 SLOAD 会在 DELEGATECALL 时使用 Contract A 的存储区，在 CALL 时使用 Contract B 的存储区。

通过学习Geth的实现你应该对DelegateCall的存储区， msg.sender和msg.value的来龙去脉有了深刻了解，对DELEGATECALL也有了一定的认识，很棒！下次再见！



