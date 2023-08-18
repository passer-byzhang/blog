---
title: Aptos中实现merkle树验证
date: 2022-10-11 11:21:12
mathjax: true
tags:
- Aptos
- Move
categories: 
- Aptos
description: merkle树验证在aptos上的实现，练练手
---

## 原理讲解：

由于区块链在存储/检索大量数据上成本过高，在一些情况下会采用用链下存储，链上验证的方法。例如如果要管理一个数万地址的白名单，使用merkle树不失为一种好方案。

![img](https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Hash_Tree.svg/310px-Hash_Tree.svg.png)
merkle树本质是一个满二叉树，它的叶子结点保存着原数据的hash值，非叶子结点存储的数据是左儿子节点和右儿子节点数据的拼接后求hash(排序后)。
如上图所示，$Hash0 = hash(Hash0\_0 + Hash0\_1)，Top Hash = hash( Hash0 + Hash1 )$。

详细介绍可见：https://mirror.xyz/qiwihui.eth/HRifb9gziR1UvVmRcMjDfDvQ9mq7o7FA6BNuCJMFT00

## 用法：

如果我们需要存储1W个地址作为白名单用户，那么全部存储和操作都在区块链上的成本明显有点太高了，我们可以利用merkle树的特性解决。步骤如下：
1.在链下使用1W个地址生成merkle树并存储。
2.并将根结点$TopHash$存入合约。
3.如果需要查询 L4 地址是否在白名单内，需要提供A地址本身和验证路径上的节点信息。例如需要验证L4在该树中，则需要提供 $Hash 1\_0$ 与 $Hash 0$.
4.在合约内验证 $hash( Hash 0 + hash(Hash 1\_ 0 + hash( L4 ))) == TopHash$ ，即可判断 L4 是否在merkle树内了。

## 实现：

### 链下部分：

链下部分负责生成 merkle 树，存储 merkle 树，获取`proof`验证路径数据。

我们可以直接使用现成的 `keccak256` 与 `merkletreejs` 库来管理merkle树，无论是存储，构建，生成验证路径，获取树根都有直接可用的方法供我们使用：
需要注意的只是要将数据结构匹配成aptos可以接受的形式

```typescript
import keccak256 from "keccak256";
import MerkleTree from "merkletreejs";
export const NODE_URL = "https://fullnode.devnet.aptoslabs.com/v1";
export const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";
export const privateKey = '0x.............';


let whitelistAddresses = [
    "0x36346bbcda6f9f74cf36cff31e00ac83c9d8a512a6564c9f93b00d249e3b2b45",
    "0x09d4ee382de0fa20f889ac6158273f29c81a1fec7385e8e26801db2e9e0c2f32",
    "0x09d4ee382de0fa20f889ac6158273f29c81a1fec7385e8e26801db2e9e0c2f32",
  ];

  let leafNodes = whitelistAddresses.map((address) => keccak256(address));
  let tree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });

  export let root = tree.getRoot();

  function convert_to_bytes(v:string[]):Uint8Array{
    let len = v.length;
    let result = new Uint8Array(32*len);
    for(let i = 0;i<len;i++){
        result.set(Buffer.from(v[i].slice(2),'hex'),i*32);
    }
    return result;
  }

  export function get_proof(account:string):Uint8Array{
    let proof = tree.getHexProof((keccak256(account)));
    return convert_to_bytes(proof)
  }
```

### 链上部分：

负责存储树根和验证计算，代码是参考 `openzeppelin` 写的 ：

Aptos 上使用 vector\<u8\>存储树根以及接收代验证数据和验证路径的原数据，

下图函数是使用 待验证的叶子结点`leaf`和验证路径数据`proof`计算`tophash`：

```rust
    fun processProof(proof:vector<u8>,leaf:vector<u8>):vector<u8>{
        assert!(vector::length(&proof)%32==0,error::invalid_argument(LENGTH_INVALID));
        let deep = vector::length(&proof)/32;
        assert!(vector::length(&leaf)==32,error::invalid_argument(LENGTH_INVALID));
        let node = leaf;
        let index = 0;
        while(index < deep){
            node = hashPair(node,extract_vector(proof,index*32,index*32+32));
            index = index +1;
        };
        node
    }
```

由于aptos不能像 evm 一样可以直接传 `byte32` 和 `byte32[]`, 我们需要对验证路径信息即 `proof` 做简单的序列化。`leaf`和拆解出来的每一个vector\<u8\>挨个拼接并取hash ，以下为拼接函数:
```rust
fun hashPair(a:vector<u8>,b:vector<u8>):vector<u8>{
        if(compare_vector(&a,&b)==SMALLER){
            vector::append(&mut a,b);
            aptos_hash::keccak256(a)
        }else{
            vector::append(&mut b,a);
            aptos_hash::keccak256(b)
        }
    }
```

这里读者可以看到有一个拼接顺序的判断，因为我们并不知道当前位置的节点是左节点还是右节点，更不知道它的父节点、爷爷节点、太爷爷节点是左节点还是右节点，所以我们无法判断拼接的顺序。
这样就需要我们在链下和链上规定同一种排序方法，使得任意给两个兄弟节点，我们都可以知道他们的左右。
在这里我们使用比大小的方式，实际上如何排序都可以，只要链上链下的规则统一就不会出问题。

最后 判断 `processProof`计算得出的数据与合约中存储的树根是否相等，确定该 `leaf` 是否存在于该树中。

```rust
 public entry fun verify(proof:vector<u8>,leaf:vector<u8>)acquires Root {
        assert!(exists<Root>(Admin),error::not_found(ROOT_UNEXISTED));
        let root = borrow_global<Root>(Admin);
        assert!(com
```

再贴一下设置树根的方法：
```rust
struct Root has key {
   hash : vector<u8>
}

public entry fun set_root(signer:&signer,new_root:vector<u8>)acquires Root{
        assert!(address_of(signer)==Admin,error::permission_denied(NO_AUTHORIZATION));
        if(!exists<Root>(Admin)){
            move_to(
                signer,
                Root{
                    hash:new_root
                }
            );
        }else{
            let root = borrow_global_mut<Root>(Admin);
            root.hash = new_root;
        }
    }
```

### 交互部分：

只需要完成执行 `set_root` 和 `verify` 两个交易的方法，使用aptos官方sdk，做好序列化就好：

设置树根：

```typescript
async function set_root(hash:string) {
    console.log(`set merkle root: ${hash}`);
    const entryFunctionPayload = new TransactionPayloadEntryFunction(
        EntryFunction.natural(          
          "0xe463a68bb1dd0d9b9864ed030a8cd357f2a38b6b3fea92c0af07694db203a6e0::merkle",         
          "set_root",
          [],
          [BCS.bcsSerializeBytes(Buffer.from(hash.slice(2),'hex')),],
        ),
      );
      const [{ sequence_number: sequenceNumber }, chainId] = await Promise.all([
        client.getAccount(admin.address()),
        client.getChainId(),
      ]);
      const rawTxn = new RawTransaction(
        AccountAddress.fromHex(admin.address()),
        BigInt(sequenceNumber),
        entryFunctionPayload,
        BigInt(2000),
        BigInt(100),
        BigInt(Math.floor(Date.now() / 1000) + 10),
        new ChainId(chainId),
      );
      const bcsTxn = AptosClient.generateBCSTransaction(admin, rawTxn);
      const transactionRes = await client.submitSignedBCSTransaction(bcsTxn);
      await client.waitForTransaction(transactionRes.hash);
    console.log(transactionRes.hash);
}
```

验证：
```typescript
async function verify(proof:Uint8Array,hash:Buffer) {
    console.log(`set merkle root: ${hash}`);
    const entryFunctionPayload = new TransactionPayloadEntryFunction(
        EntryFunction.natural(          
          "0xe463a68bb1dd0d9b9864ed030a8cd357f2a38b6b3fea92c0af07694db203a6e0::merkle",          
          "verify",          
          [],
          [BCS.bcsSerializeBytes(proof),BCS.bcsSerializeBytes(hash)],
        ),
      );
      console.log(BCS.bcsSerializeBytes(proof));
      console.log(BCS.bcsSerializeBytes(hash));
    
      const [{ sequence_number: sequenceNumber }, chainId] = await Promise.all([
        client.getAccount(admin.address()),
        client.getChainId(),
      ]);
      const rawTxn = new RawTransaction(
        AccountAddress.fromHex(admin.address()),
        BigInt(sequenceNumber),
        entryFunctionPayload,
        BigInt(2000),
        BigInt(100),
        BigInt(Math.floor(Date.now() / 1000) + 10),
        new ChainId(chainId),
      );
      const bcsTxn = AptosClient.generateBCSTransaction(admin, rawTxn);  
      const transactionRes = await client.submitSignedBCSTransaction(bcsTxn);
      await client.waitForTransaction(transactionRes.hash);
    console.log(transactionRes.hash);
}

let account = '0x09d4ee382de0fa20f889ac6158273f29c81a1fec7385e8e26801db2e9e0c2f32'
//console.log('0x254a8d20f95c8a0ac2cb39041ba3375f6742dea2accf4361028e43ea669b8a91');
verify(get_proof(account),keccak256(account));
```

源码仓库地址：https://github.com/passer-byzhang/aptos-merkle
作者地址：alvan.coffee












