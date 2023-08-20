---
title: 无需合约，在Aptos上发布NFT
date: 2022-07-31 22:43:04
tags: 
- Rust
- Aptos
categories: Aptos
description: Aptos链入门，铸造和交易NFT
---


从前有一个大网红Diana坐拥百万粉丝，她有一天突发奇想，想给每一个粉丝发放一个粉丝牌NFT，那么她应该怎么做呢？第一步，她需要部署一张NFT合约；第二步，铸造100万枚粉丝牌NFT；第三步，将粉丝牌NFT发送给粉丝。先不说天价gas费和Diana小姐会不会写合约，这一套下来等到粉丝全部收到粉丝牌保守估计得有四五天了，Diana很是头疼，怎么办呢。

直到直播间的穷哥们小A发现了Aptos，这条链有着很强的性能和很低的使用门槛，链上内置了原生的NFT合约，这就省去了第一步的麻烦，又由于其超高性能，第二第三步居然可以在几个小时内解决！小A立刻来了精神，要是把这件事拿下，Diana小姐岂不是会尊敬我崇拜我爱上我对我欲罢不能？

这就开干：

由于下面会复用aptos官方example中的部分代码，可以先阅读该篇文章：http://alvan.coffee/2022/07/30/aptos-tutorial

Aptos官网有铸造nft的example，python版本和typescript版本，rust版本还没有添加，那我们就用rust写了补全一下吧。

第一步，构造一个Client用于和Aptos节点和水龙头交互：

```rust
pub struct NftClient {
    url: String,
    pub rest_client: RestClient,
}

impl NftClient {
    /// Represents an account as well as the private, public key-pair for the Aptos blockchain.
    pub fn new(url: &str) -> Self {
        Self {
            url: url.to_string(),
            rest_client: RestClient::new(url.to_string()),
        }
    }
   pub fn submit_transaction_helper(&self, account: &mut Account, payload: Value) {
        self.rest_client
            .execution_transaction_with_payload(account, payload);
    }
}
```

这里复用了上一篇文章的RestClient，官方样例很贴心地把构造，提交，验证交易相关的操作都写好了，我们只需要添加业务层面的逻辑，也就是写写REST请求体就可以了。

第二步，铸造NFT

Nft在所谓0x1合约也就是`aptos-framework`中，提供了数种创建collection和token的方法。

在aptos里我们可以创建有限或无限的Nft系列(collection)，根据业务需要，有些系列的NFT要强调稀缺性，有些系列则需要持续铸造，我们可以用选择不同的方法。这里我们使用`create_unlimited_collection_script`和`create_unlimited_token_script`，在`aptos-move/framework/aptos-framework/sources/token.move`中我们可以看到更详细的说明。

在创建好collection后我们就可以去铸造该collection下的token了，可以批量生产，supply参数就是产量。

我们只需要很简单的根据需求构造出对应name，description和url的collection/token，然后把它们塞进payload里，用自己的账户把交易发出去就ok了。

```rust
pub fn create_collection(
        &self,
        account: &mut Account,
        name: &str,
        uri: &str,
        description: &str,
    ) {
        let payload = serde_json::json!({
            "type": "script_function_payload",
            "function": "0x1::token::create_unlimited_collection_script",
            "type_arguments": [],
            "arguments": [
                hex::encode(name.as_bytes()),
                hex::encode(description.as_bytes()),
                hex::encode(uri.as_bytes()),
            ]
        });
        self.submit_transaction_helper(account, payload)
    }
    pub fn create_token(
        &self,
        account: &mut Account,
        collection_name: &str,
        name: &str,
        description: &str,
        supply: i32,
        uri: &str,
    ) {
        let payload = serde_json::json!({
            "type": "script_function_payload",
            "function": "0x1::token::create_unlimited_token_script",
            "type_arguments": [],
            "arguments": [
                hex::encode(collection_name.as_bytes()),
                hex::encode(name.as_bytes()),
                hex::encode(description.as_bytes()),
                true,
                supply.to_string().as_str(),
                hex::encode(uri.as_bytes()),
                "0",
            ]
        });
        self.submit_transaction_helper(account, payload)
    }
```

第三步，交易NFT

由于aptos独特的所有权机制，转移nft其实并不是合约记一下账这么简单，需要分为两步走，发送方发送`(offer_token`)之后，接收方还要声明接收一下(`claim_token`)，这两个方法都在`0x1::token_transfers`合约里，文件在`aptos-move/framework/aptos-framework/sources/token_transfers.move`

值得注意的是，想要转移nft，需要知道创建者地址，collection名和name名。

```rust
pub fn offer_token(
        &self,
        account: &mut Account,
        receiver: &str,
        creator: &str,
        collection_name: &str,
        token_name: &str,
        amount: i32,
    ) {
        let payload = serde_json::json!({
            "type": "script_function_payload",
            "function": "0x1::token_transfers::offer_script",
            "type_arguments": [],
            "arguments": [
                receiver,
                creator,
                hex::encode(collection_name.as_bytes()),
                hex::encode(token_name.as_bytes()),
                amount.to_string().as_str()
            ]
        });
        self.submit_transaction_helper(account, payload)
    }
    pub fn claim_token(
        &self,
        account: &mut Account,
        sender: &str,
        creator: &str,
        collection_name: &str,
        token_name: &str,
    ) {
        let payload = serde_json::json!({
            "type": "script_function_payload",
            "function": "0x1::token_transfers::claim_script",
            "type_arguments": [],
            "arguments": [
                sender,
                creator,
                hex::encode(collection_name.as_bytes()),
                hex::encode(token_name.as_bytes())
            ]
        });
        self.submit_transaction_helper(account, payload)
    }
```

第四步，查询NFT

现在交易写完了，我们查询一下NFT的持有量和数据，这就复用到了上一篇文章里的`account_resource`，无论什么资源，原生代币还是项目代币，抑或是NFT，他们都是我们账户的资源(resource)，所以使用这个就可以查到我们持有的nft了。

```rust
    pub fn get_collection(&self, creator: &str, collection_name: &str) -> Value {
        let collection = &self
            .rest_client
            .account_resource(creator, "0x1::token::Collections")
            .unwrap()["data"]["collections"]["handle"];
        match collection {
            Value::String(s) => self.get_table_item(
                s.as_str(),
                "0x1::string::String",
                "0x1::token::Collection",
                Value::String(collection_name.to_string()),
            ),
            _ => panic!("get_collection:error"),
        }
    }
    pub fn get_token_balance(
        &self,
        owner: &str,
        creator: &str,
        collection_name: &str,
        token_name: &str,
    ) -> Value {
        let token_store = &self
            .rest_client
            .account_resource(owner, "0x1::token::TokenStore")
            .unwrap()["data"]["tokens"]["handle"];
        let token_id = serde_json::json!({
            "creator": creator,
            "collection": collection_name,
            "name": token_name,
        });
        match token_store {
            Value::String(s) => {
                self.get_table_item(s, "0x1::token::TokenId", "0x1::token::Token", token_id)
                    ["value"]
                    .clone()
            }
            _ => panic!("get_token_balance:error"),
        }
    }
    pub fn get_token_data(&self, creator: &str, collection_name: &str, token_name: &str) -> Value {
        let token_data = &self
            .rest_client
            .account_resource(creator, "0x1::token::Collections")
            .unwrap()["data"]["token_data"]["handle"];
        let token_id = serde_json::json!({
            "creator": creator,
            "collection": collection_name,
            "name": token_name,
        });
        match token_data {
            Value::String(s) => self
                .get_table_item(s, "0x1::token::TokenId", "0x1::token::TokenData", token_id)
                .clone(),
            _ => panic!("get_token_data:error"),
        }
    }
```

写完之后，小A把代码放在这里：https://github.com/passer-byzhang/aptos-core/tree/main/developer-docs-site/static/examples/rust/first_nft

随着测试代码绿油油的passed，小A开心地私信了Diana小姐，但是不知道为什么弹出了：由于对方隐私设置，无法发送私信。呵呵，一定是平台针对我，等进入了Web3时代，就不会有这样的事了吧，小A这样想着，合上电脑去睡觉了。