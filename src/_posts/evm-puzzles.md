---
title: 通过 EVM PUZZLES 学习 EVM opcodes
date: 2023-03-14 14:58:53
tags:
- solidity
- ethereum
categories: ethereum
description: 十道题熟悉 evm opcode
---

Evm puzzles 是一套练习和入门 evm 执行原理和 opcode 的习题，里边涉及到简单的 opcode 操作，如操作堆栈，操作内存，操作 calldata ，部署合约等等，更重要的是它只有十道题，即使是新手也可以在几个小时内解决谜题！让我们开始吧！

规则：输入恰当的 calldata 和 value，使得题目的 opcode 正确执行，直到执行STOP。

puzzle 交互工具：https://github.com/fvictorio/evm-puzzles

## puzzle 1:

题目：

```assembly
pc      opcode  opcode name
00      34      CALLVALUE
01      56      JUMP
02      FD      REVERT
03      FD      REVERT
04      FD      REVERT
05      FD      REVERT
06      FD      REVERT
07      FD      REVERT
08      5B      JUMPDEST
09      00      STOP
```

此题简单明了，我们需要跳转至`pc = 0x08`才能避免中途 revert，所以`0x01`位置的`JUMP`应该跳转至 `0x08`。
根据evm文档，JUMP 操作 的模式为：

| stack | name      | gas  | initial stack | result stack | mem/storage |
| ----- | --------- | ---- | ------------- | ------------ | ----------- |
| 56    | JUMP      | 8    | dst           | /            | /           |
| 34    | CALLVALUE | 2    | /             | msg.value    | /           |

即：CALLVALUE 把 msg.value 放在调用栈上，JUMP 从调用栈的一个值，跳转至该值位置。
现在应该很清楚了 msg.value == 8 即可通关。

## puzzle 2:

题目：

```assembly
pc      opcode  opcode name
00      34      CALLVALUE
01      38      CODESIZE
02      03      SUB
03      56      JUMP
04      FD      REVERT
05      FD      REVERT
06      5B      JUMPDEST
07      00      STOP
08      FD      REVERT
09      FD      REVERT
```

此题跟 puzzle 1 差不多，只新增了两个 opcode，我们依然先看文档：



| stack | name     | gas  | initial stack | result stack   | mem/storage |
| ----- | -------- | ---- | ------------- | -------------- | ----------- |
| 38    | CODESIZE | 2    | /             | len(this.code) | /           |
| 03    | SUB      | 3    | a,b           | a - b          | /           |

我们先使用 CALLVALUE 将 msg.value 压入调用栈，再把代码长度压栈，我们可以看到我们的 code 总长度为10，也就是 `10 - msg.value == 0x06`，可得 msg.value == 4。题解结束。

## puzzle 3:

题目：

```assembly
pc      opcode  opcode name
00      36      CALLDATASIZE
01      56      JUMP
02      FD      REVERT
03      FD      REVERT
04      5B      JUMPDEST
05      00      STOP
```

新增了一个 opcode:

| stack | name         | gas  | initial stack | result stack  | mem/storage |
| ----- | ------------ | ---- | ------------- | ------------- | ----------- |
| 36    | CALLDATASIZE | 2    | /             | len(msg.data) | /           |

只要我们的 `len(msg.data) == 4` 即可完成题解，例如 `msg.data == 0x00000000`

## puzzle 4:

题目：

```assembly
pc      opcode  opcode name
00      34      CALLVALUE
01      38      CODESIZE
02      18      XOR
03      56      JUMP
04      FD      REVERT
05      FD      REVERT
06      FD      REVERT
07      FD      REVERT
08      FD      REVERT
09      FD      REVERT
0A      5B      JUMPDEST
0B      00      STOP
```

XOR 大家应该都很熟悉了, 就是 pop 两个操作栈里的值，然后把异或结果 pop 回去：

| stack | name | gas  | initial stack | result stack | mem/storage |
| ----- | ---- | ---- | ------------- | ------------ | ----------- |
| 18    | XOR  | 3    | a,b           | a ^ b        | /           |

我们需要保证 `msg.value xor codesize == 0x0A`。0x0A 的二进制表示为 0000 1010，而我们可以知道 codesize == 0c（10进制的12）,二进制表示为0000 1100，可以计算出 `msg.data == 6` 即二进制表示为 0000 0110。

## puzzle 5:

题目：

```assembly
pc      opcode      opcode name
00      34          CALLVALUE
01      80          DUP1
02      02          MUL
03      610100      PUSH2 0100
06      14          EQ
07      600C        PUSH1 0C
09      57          JUMPI
0A      FD          REVERT
0B      FD          REVERT
0C      5B          JUMPDEST
0D      00          STOP
0E      FD          REVERT
0F      FD          REVERT
```

认识一下新的 opcode:



| stack | name  | gas  | initial stack  | result stack | mem/storage |
| ----- | ----- | ---- | -------------- | ------------ | ----------- |
| 80    | DUP1  | 3    | a              | a,a          | /           |
| 02    | MUL   | 5    | a,b            | a * b        | /           |
| 60    | PUSH1 | 3    | .              | uint8        | /           |
| 61    | PUSH2 | 3    | .              | uint16       | /           |
| 14    | EQ    | 3    | a,b            | a == b       | /           |
| 57    | JUMPI | 10   | dst, condition | /            | /           |

DUP1：将栈顶元素再复制一份放在栈顶。
MUL：pop 栈顶两元素，push a*b 的结果到栈顶。
PUSH1/PUSH2：把一个元素放在栈顶，如610100 即使用 PUSH2(61) 将 8(0100) 放在栈顶。
EQ：pop 栈顶两元素，push a==b 的结果到栈顶。
JUMPI：取栈顶两元素，分别是 dst 和 condition，如果 condition == 1 则跳转到 `pc == dst`的位置，否则，执行下一条语句。

我们可以从结果往前推，目的是达到`0x0d`位置的 STOP，需要通过跳转达到`0x0c`，也就是来自 `pc == 0x09`位置的 JUMPI 。
`pc == 0x07` 处我们得知，此时的栈顶元素是 PUSH1 操作符操作的 `0x0c`，这正好与我们的目标地址相等。也就是说明 JU MPI 的 condition 为真。即`pc == 0x06`处的 EQ 返回为真。
再往上就简单多了 ，其实只需要满足 `msg.value*msg.value == 0x0100` 注意，这里的0100是16进制数字而非二进制数字，所以`msg.data*msg.data == 256` 即  `msg.data == 16` 完成题解。

## puzzle 6:

题目：

```assembly
pc      opcode  opcode name
00      6000      PUSH1 00
02      35        CALLDATALOAD
03      56        JUMP
04      FD        REVERT
05      FD        REVERT
06      FD        REVERT
07      FD        REVERT
08      FD        REVERT
09      FD        REVERT
0A      5B        JUMPDEST
0B      00        STOP
```

新增一个 opcode:

| stack | name         | gas  | initial stack | result stack         | mem/storage |
| ----- | ------------ | ---- | ------------- | -------------------- | ----------- |
| 35    | CALLDATALOAD | 3    | idx           | msg.data[idx:idx+32] | /           |

简单明了 pop 栈顶元素作为 idx ，把 msg.data 从 idx 开始的32位写入操作栈。
这样我们可以直接获得构造条件：`msg.data[0:32]== 0x000000000000000000000000000000000000000000000000000000000000000a` 即可

## puzzle 7:

题目：

```assembly
pc      opcode    opcode name
00      36        CALLDATASIZE
01      6000      PUSH1 00
03      80        DUP1
04      37        CALLDATACOPY
05      36        CALLDATASIZE
06      6000      PUSH1 00
08      6000      PUSH1 00
0A      F0        CREATE
0B      3B        EXTCODESIZE
0C      6001      PUSH1 01
0E      14        EQ
0F      6013      PUSH1 13
11      57        JUMPI
12      FD        REVERT
13      5B        JUMPDEST
14      00        STOP
```

从第7题开始难度会增加一些，我们先看一下新引入的opcode吧



| stack | name         | gas      | initial stack    | result stack   | mem/storage                                         |
| ----- | ------------ | -------- | ---------------- | -------------- | --------------------------------------------------- |
| 37    | CALLDATACOPY | 3+       | dstOst, ost, len | /              | mem[dstOst:dstOst+len-1] := msg.data[ost:ost+len-1] |
| F0    | CREATE       | 32000+   | val, ost, len    | addr           | /                                                   |
| 3B    | EXTCODESIZE  | 100/2600 | addr             | len(addr.code) | /                                                   |

CALLDATACOPY 简单明了，就是 pop 出三个栈顶元素，记为dstOst, ost, len。把`msg.data[ost:ost+len-1]`	复制到内存：`msg.data[ost:ost+len-1]`

CREATE 相对复杂，它是一个部署合约的 opcode，pop 出三个栈顶元素，记为val, ost, len。
val 是创建合约时传入的 eth 数目。
mem[ost:ost+len-1] 是合约的 contract code。
addr 返回值是已创建合约的地址。

EXTCODESIZE 取出栈顶元素，然后返回该合约的 code 长度。

我们先看第一段，`0x00` - `0x05`

```assembly
pc      opcode    opcode name
00      36        CALLDATASIZE
01      6000      PUSH1 00
03      80        DUP1
04      37        CALLDATACOPY
05      36        CALLDATASIZE
```

这一段其实就是把 `msg.data` 整个复制到内存`mem`。

第二段，`0x06`-`0x0a`

```assembly
pc      opcode  opcode name
06      6000      PUSH1 00
08      6000      PUSH1 00
0A      F0        CREATE
```

把 `mem`上的代码部署到链。并把合约地址写回栈顶。

第三段，`0x0b`-`0x14`

```assembly
pc      opcode    opcode name
0B      3B        EXTCODESIZE
0C      6001      PUSH1 01
0E      14        EQ
0F      6013      PUSH1 13
11      57        JUMPI
12      FD        REVERT
13      5B        JUMPDEST
14      00        STOP
```

我们可以看到要正确跳转需要满足的条件是 `len(address.code) == 1`。

现在的问题是，新创建合约使用的code是我们的 msg.data，那是不是意味着部署后合约的 code 也是msg.data 呢？其实不然。创建合约的 code 被称为 creation code, 而最终留在区块链里的合约代码被称为 runtime code。这其实隐含着 conrtuctor的内容，contructor 只存在于 creation code 而非 runtime code ，这也是构造函数只被执行一次的原因。合约 creation code 会在一个交易里执行，并把 runtime code通过 `RETURN` 返回。

我们还需要额外引入一个 opcode:

| stack | name   | gas  | initial stack | result stack | mem/storage |
| ----- | ------ | ---- | ------------- | ------------ | ----------- |
| F3    | RETURN | *    | ost, len      | /            | /           |

ost 为 runtime code 在内存的起始位置，len 为截取长度，我们尝试构建一个 creation code:

```assembly
pc      opcode    opcode name
00      6001      PUSH1 01
02      6000      PUSH1 00
04      F3        RETURN
```

这样我们返回的 runtime code 的长度就只是从内存中取出的一位操作符了。

也就是 `msg.data == 0x60016000f3` 即可完成 puzzle ！

## puzzle 8:

题目：

```assembly
pc      opcode    opcode name
00      36        CALLDATASIZE
01      6000      PUSH1 00
03      80        DUP1
04      37        CALLDATACOPY
05      36        CALLDATASIZE
06      6000      PUSH1 00
08      6000      PUSH1 00
0A      F0        CREATE
0B      6000      PUSH1 00
0D      80        DUP1
0E      80        DUP1
0F      80        DUP1
10      80        DUP1
11      94        SWAP5
12      5A        GAS
13      F1        CALL
14      6000      PUSH1 00
16      14        EQ
17      601B      PUSH1 1B
19      57        JUMPI
1A      FD        REVERT
1B      5B        JUMPDEST
1C      00        STOP
```

难度比起 puzzle 7 更上一层楼，我们先看看涉及到了几个新的 opcode:



| stack | name  | gas                           | initial stack                                  | result stack | mem/storage                               |
| ----- | ----- | ----------------------------- | ---------------------------------------------- | ------------ | ----------------------------------------- |
| 94    | SWAP5 | 3                             | a, ..., b                                      | b, ..., a    | /                                         |
| 5A    | GAS   | 2                             | /                                              | gasRemaining | /                                         |
| F1    | CALL  | base_gas + gas_sent_with_call | gas, addr, val, argOst, argLen, retOst, retLen | success      | mem[retOst:retOst+retLen-1] := returndata |

SWAP 系列的 opcode 很好理解，SWAP1 是把栈顶的 a，b 变成 b，a，SWAP5 就是把 a,x,x,x,x,,b 变成 b,x,x,x,x,a。
GAS 是计算 gas 费并写入栈顶。
CALL 即为调用合约，其使用到的栈顶元素 分别为 gas, addr(合约地址), val(msg.data), argOst(在内存中截取的输入数据起点), argLen(输入数据长度), retOst(在内存中截取的返回数据起点), retLen(返回数据长度)。若交易成功 将 1 写入栈顶，若失败，将0写入栈顶。

我们先看第一段：

```assembly
pc      opcode    opcode name
00      36        CALLDATASIZE
01      6000      PUSH1 00
03      80        DUP1
04      37        CALLDATACOPY
05      36        CALLDATASIZE
06      6000      PUSH1 00
08      6000      PUSH1 00
0A      F0        CREATE
```

z这一段跟 puzzle 7 一样，把我们 msg.data 的数据当成合约部署在链上，再把新创建的合约地址写回栈顶。

第二段：

```assembly
pc      opcode    opcode name
0B      6000      PUSH1 00
0D      80        DUP1
0E      80        DUP1
0F      80        DUP1
10      80        DUP1
11      94        SWAP5
12      5A        GAS
13      F1        CALL
```

这一段运行下到最后，我们可以知道这是一个 call 命令，参数依次是 gas , addr , 0, 0, 0, 0, 0。也就是不传入数据，没有返回值，不传入value, 若运行成功则把 1 压栈，反之压栈 0。

第三段

```assembly
pc      opcode    opcode name
14      6000      PUSH1 00
16      14        EQ
17      601B      PUSH1 1B
19      57        JUMPI
1A      FD        REVERT
1B      5B        JUMPDEST
1C      00        STOP
```

这一段就是用来反推我们合约返回结果的部分了，我们需要从上一个部分得到一个 `0x00`，使得EQ返回值为 1，方能成功触发 JUMPI 跳到终点。也就说明我们需要本次合约交易失败。这其实很简单，我们构造一个合约使得 runtime code只有一个 revert 就可以了，类似 puzzle 7，再稍微加点东西：

```assembly
pc      opcode    opcode name
00      60FD      PUSH1 FD //FD 是revert操作符的编号
02      6000      PUSH1 00
04      53        MSTORE8
05      6001      PUSH1 01
07      6000      PUSH1 00
09      F3        RETURN
```

这样，我们把 `0xfd` 写入内存 `0x00`了。这也就是我们的 runtime code。

这样我们得出题解：`msg.data == 0x60fd60005360016000f3`

## puzzle 9:

题目：

```assembly
pc      opcode    opcode name
00      36        CALLDATASIZE
01      6003      PUSH1 03
03      10        LT
04      6009      PUSH1 09
06      57        JUMPI
07      FD        REVERT
08      FD        REVERT
09      5B        JUMPDEST
0A      34        CALLVALUE
0B      36        CALLDATASIZE
0C      02        MUL
0D      6008      PUSH1 08
0F      14        EQ
10      6014      PUSH1 14
12      57        JUMPI
13      FD        REVERT
14      5B        JUMPDEST
15      00        STOP
```

经历了 puzzle 7 && puzzle 8 的折磨，接下来的两道题实际上已经难不住我们了，先看新出现的 opcode 文档，非常简单：



| stack | name | gas  | initial stack | result stack | mem/storage |
| ----- | ---- | ---- | ------------- | ------------ | ----------- |
| 10    | LT   | 3    | a, b          | a < b        | /           |
| 02    | MUL  | 5    | a,b           | a * b        | /           |

第一段：

```assembly
pc      opcode    opcode name
00      36        CALLDATASIZE
01      6003      PUSH1 03
03      10        LT
04      6009      PUSH1 09
06      57        JUMPI
07      FD        REVERT
08      FD        REVERT
09      5B        JUMPDEST
```

我们可以得出一个限制：`0x03 < len(msg.data)`

第二段：

```assembly
pc      opcode    opcode name
0A      34        CALLVALUE
0B      36        CALLDATASIZE
0C      02        MUL
0D      6008      PUSH1 08
0F      14        EQ
10      6014      PUSH1 14
12      57        JUMPI
13      FD        REVERT
14      5B        JUMPDEST
15      00        STOP
```

很容易得出另一个限制 `len(msd.data) * msg.value == 8`, 又根据第一部分的限制，我们可以随意构造一个长度为4的m sg.data，然后令 msg.value == 2。

即可构造出一个符合题意的题解：
`msg.value == 2`
`msg.data == 0x12121212`

## puzzle 10:

题目：

```assembly
pc      opcode      opcode name
00      38          CODESIZE
01      34          CALLVALUE
02      90          SWAP1
03      11          GT
04      6008        PUSH1 08
06      57          JUMPI
07      FD          REVERT
08      5B          JUMPDEST
09      36          CALLDATASIZE
0A      610003      PUSH2 0003
0D      90          SWAP1
0E      06          MOD
0F      15          ISZERO
10      34          CALLVALUE
11      600A        PUSH1 0A
13      01          ADD
14      57          JUMPI
15      FD          REVERT
16      FD          REVERT
17      FD          REVERT
18      FD          REVERT
19      5B          JUMPDEST
1A      00          STOP
```

和第九题很类似，我们看一下新增的几个 opcode，也都很简单:

| stack | name     | gas  | initial stack | result stack   | mem/storage |
| ----- | -------- | ---- | ------------- | -------------- | ----------- |
| 38    | CODESIZE | 2    | /             | len(this.code) | /           |
| 11    | GT       | 3    | a,b           | a > b          | /           |
| 01    | ADD      | 3    | a,b           | a + b          | /           |
| 06    | MOD      | 5    | a,b           | a % b          | /           |
| 15    | ISZERO   | 3    | a             | a == 0         | /           |

值得注意的是，codesize是指我们正在运行的代码的长度，本题中我们可以看到是 21 (0x1b)。

第一段：

```assembly
pc      opcode      opcode name
00      38          CODESIZE
01      34          CALLVALUE
02      90          SWAP1
03      11          GT
04      6008        PUSH1 08
06      57          JUMPI
07      FD          REVERT
08      5B          JUMPDEST
```

我们得到第一条限制 ` 21 > msg.value`

第二段：

```assembly
pc      opcode      opcode name
09      36          CALLDATASIZE
0A      610003      PUSH2 0003
0D      90          SWAP1
0E      06          MOD
0F      15          ISZERO
10      34          CALLVALUE
11      600A        PUSH1 0A
13      01          ADD
14      57          JUMPI
15      FD          REVERT
16      FD          REVERT
17      FD          REVERT
18      FD          REVERT
19      5B          JUMPDEST
1A      00          STOP
```

我们从结果反推`0x14`处， JUMPI 的 dst 操作数 应为 `0x19`指向`0x19`处的JUMPDEST，condition 操作数应为 1。
这其实就是 `0x13`处 ADD 的结果为 `0x19`，`0x0f`处的 ISZERO 结果为 1。

即 `len(msg.data) % 3 == 0`，`msg.data + 10 == 25`（0x0A的十进制是10，0x19的十进制是25）。

我们可以构造一个题解：
`msg.value == 15`
`msg.data == 0x121212`

