---
title: 金融特化，现金交易，浅析新公链Aptos与Move语言
date: 2022-08-29 15:59:16
tags: 
- Move
- Aptos
categories: Aptos
description: aptos和move的一些安全特性，跟rust很像

---

## 前言

Aptos 的 AIT3 注册快结束了，Alvan搞完节点也终于空出时间来整理一个关于Aptos和Move的分享，这篇文章会讲一下Aptos和Move的优势和特性，以及觉得它们中很有意思的地方。

## Aptos的前世今生

2019年有一个Libra项目后来改名diem，运营不善后diem项目组秽土转生出了分裂成了两个项目，aptos和sui，他们从diem继承的共同遗产就是move语言。

这两个是一个专注于高性能高安全,不兼容evm的layer1，pos机制。一个承袭了老项目多一点，一个自由发挥多一点。
aptos目前还处于测试阶段，根据项目方透露今年万圣节之前可以主网上线。

目前已经有四十多个项目已经宣布加入aptos生态，钱包和nft市场以及开发者工具之类项目量大管饱，但是目前真正完成并上线测试网并且开源的很少。一方面是由于现在版本迭代太快，不太稳定，另一方面就是很多solidity的团队需要时间去学习使用Move投入生产。

## Aptos有哪些特性呢

Aptos其实写的很明白，它和其他传统区块链的最大区别就是高效(存疑)和安全。

第一点是使用了流水线模式，增强了并行程度，根据开发团队声称tps可以到十万，但是测试网明显没有压榨出最大的效率，究竟能达到什么程度持保留意见，毕竟以太坊升级之后的理想状态也是超过十万的。

第二点，我觉得这是它与以太坊差异最大的的设计，就像下图所示，

![aptos分享稿.004](aptosShares.004.png)

以太坊的storage，是合约账户拥有的一块存储区，里边每个合约存储着不同人的账户信息，
aptos里的信息被称为resource资源，存在每一个外部账户的存储区里。
这有什么区别呢，要实现一个A token的记账，以太坊的做法是在A token合约里存一个map，key是账户地址，value是账户余额，要空投币就是在合约内部去找key改value。而aptos的做法是在A token合约里声明一个叫coin的resoure，然后把resource发送给用户，这样A token就到了用户的存储区。如果对应现实世界的话，一种是记账模式，一种是现金模式。这个之后我们再讲。



## Move语言又是何方神圣

讲完aptos链本身，现在我们开始看看时薪1200刀的Move语言，它并不是一个新玩意了,Libra(Diem)时期就已经投产的语言，也被Sui和aptos继承了，现在最全的Move文档依然在Diem的网站下边挂着。

它脱胎于rust,很多设计和概念都有相似。Move声称对solidity的优势是安全高效，实际上rust对Cpp和GC语言的优势也分别是安全和高效,也就会围绕着这两点介绍move的特性。可能会涉及到一些概念没接触过也不要紧，我会简单说明一下，并不会耽误理解。

首先我们从安全说起，在我们编程的时候肯定会遇到一个重要的问题，如果它不是你编程时遇到的问题，那一定也是面试的时候一定会遇到问题，就是申请和回收内存。

C++在处理变量或者指针时，需要全程手动，所以C++程序员的心智负担很重，他也不知道哪里出现一个悬垂指针哪里有一个内存泄漏，软件的可靠性就会极度依赖开发者的水平。

Java和Go使用了GC机制，在运行的时候有一个GC程序监控记录引用情况，在变量失效时清除，这让程序员的日子好过不少，但是意味着一定会造成额外的性能开销。

那么有没有既不增加开销还能自动管理内存的方案呢？答案是肯定的，Rust或者说Move的 生命周期+所有权 是一个用语法规范内存操作的方案，可以把内存安全检测放在编译期解决。

简单来说像这段rust代码一样

```rust
fn timelife_and_ownership()->String{
    let x :String = "hello aptos".to_string();//x的生命周期开始，开辟内存
    {
        let y :String = "hello move".to_string();//y的生命周期开始，开辟内存
    }//y的生命周期结束，回收内存
    //println!("{}",y); error:cannot find value `y` in this scope
    x
}//x的生命周期结束，回收内存
```

每一个变量有一个作用域，也就是一个大括号代码块。
当程序运行出代码块时，就把这块里声明的内存清理掉了。这样在编译期就能解决指针乱飞的问题，也不会造成额外开销，同时是把它变得高效的根本原因。

所有权又是什么呢？
在rust里，每一个变量都有一个所有者，其他变量想要使用它需要复制或者借用/引用。而move把这个思路用在了处理资源上，资源其实就是我们存储区上的数据，比如我们刚才说的A token。

每一个资源有四个可选ability：Copy，Drop，Store，Key。Copy表示可以被复制，Drop的意思是可以销毁该资源，store表示可以存进全局也就是区块链，key表示该资源可以被检索。

他们之间也有一定耦合，比如一个拥有key的结构体，它里边的资源肯定是store的，这是不言自明的。使用的时候就是在声明变量的后边加上"has copy"，‘has key’。

```rust
struct MessageHolder has key {
        message: string::String,
        message_change_events: event::EventHandle<MessageChangeEvent>,
    }

    struct MessageChangeEvent has drop, store {
        from_message: string::String,
        to_message: string::String,
    }
```

我们完全可以按照写程序的思维去理解它的顶层设计。上文提到了所有权和借用，当一个借用是不可变借用的时候它当然是安全的，如果是可变借用，那必须只有一个，不然这段代码就很难安全(最重要的是不知道什么时候释放)，尤其是在异步程序里。

在move里可变引用和不可变引用分别是borrow_global 和 borrow_global_mut

aptos官方的coin设计里是这样的

![aptos分享稿.011](aptos分享稿.011.png)



某人持有的资金是存在自己存储区下的一个resource，我们暂且把它称为Coin，实现持有就是把amount放进一个没有copy和drop的资源Coin里，转账的时候是切割/合并Coin资源来实现。这样资源相当于被实体化了，在同一时间里想要有可变的Coin资源只能被一个所有者修改，避免了很多安全问题。跟以太坊的账户转账相比一个是账本模式一种现金模式。感觉有点UTXO的味道。

标准库代码：

这是标准coin的transfer函数，可以看到分为两步，发送方withdraw，接收方deposit。

```rust
/// Transfers `amount` of coins `CoinType` from `from` to `to`.
    public entry fun transfer<CoinType>(
        from: &signer,
        to: address,
        amount: u64,
    ) acquires CoinStore {
        let coin = withdraw<CoinType>(from, amount);
        deposit(to, coin);
    }
```

withdraw与extract函数，请看注释

```rust
/// Withdraw specifed `amount` of coin `CoinType` from the signing account.
    public fun withdraw<CoinType>(
        account: &signer,
        amount: u64,
    ): Coin<CoinType> acquires CoinStore {
        let account_addr = signer::address_of(account);
        assert!(
            is_account_registered<CoinType>(account_addr),
            error::not_found(ECOIN_STORE_NOT_PUBLISHED),
        );
        //先用变量coin_store拿到account_addr中coin资源的所有权
        let coin_store = borrow_global_mut<CoinStore<CoinType>>(account_addr);

        event::emit_event<WithdrawEvent>(
            &mut coin_store.withdraw_events,
            WithdrawEvent { amount },
        );
				//分割coin，并返回一个coin
        extract(&mut coin_store.coin, amount)
    }
    public fun extract<CoinType>(coin: &mut Coin<CoinType>, amount: u64): Coin<CoinType> {
        assert!(coin.value >= amount, error::invalid_argument(EINSUFFICIENT_BALANCE));
        //修改传入coin的值
        coin.value = coin.value - amount;
        //创建一个新coin并返回
        Coin { value: amount }
    }
```

接收方的deposit就是上述操作的逆操作而已。我们可以在上述代码中看到所有权的流动。

我们再往下想从这个方面来讲，aptos里就没有了token和CryptoCurrency的高低贵贱之分，在以往以太坊里边eth是一等公民，erc20是二等公民，在aptos里所有的coin理论上都是同等地位，因为他们都是resource，也不用在写合约的时候把e th和erc20每一个都写一个分支逻辑了。

从存储区的角度来说，一切信息存在用户处，合约反而成了一个纯粹的lib，这也使得合约的逻辑和存储天然分离，更有助于智能合约的去中心化。

## 结语

Aptos的业务模型和Move合约的设计远远比高性能更让人拍案叫绝，在学习的时候忍不住把它们和rust联系起来(因为真的很像)，一点粗浅理解，还望诸君包涵！





