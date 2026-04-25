# 符号体系概述

全面支持Martin Fowler《分析模式》附录A "Type Diagrams"中的符号体系。包括 **Type**，**Association/Mapping**，**Cardinality**，**Type Generalization**，**Short Semantic Statement**, **Long Semantic Statement**

## 1 Type（类型）

Type表示建模中的类型（注意：Martin Fowler的notation中只有type，没有class和interface的概念）。Type内部只需要名称，不需要属性和操作等细节。（书中的复杂的Type也有property和action，这些在项目后期加入）

## 2 Association/Mapping (关联/映射)

一个 Association 连结了两个 Type。
Association 没有任何属性和类型，视觉上就是一条线段，把两个Type连结起来。

每个连结了 Type A和Type B 的 Association 都包括两个 Mapping，即Type A到Type B的 Mapping，和Type B到Type A的 Mapping。Mapping可以是：
- 包含cardinality的（见##3），或者
- derived，或者
- unknown

## 3 Cardinality（基数）

Cardinality(基数) 是集合论和数据库中的常见概念，表示数量的多少或不同值的个数。
在本符号体系中，Cardinality 是一个 Mapping 的性质。因此，一个 Association 包含两个 Mapping，也就包含两个 Cardinality。
在视觉效果上，数字0、1和多个，有特殊的标识，0 是 〇，1是｜，多个是乌鸦脚。
所以，[0,1]就是 〇｜，[1,*]就是｜和乌鸦脚。具体的视觉效果，参考[基数表示](./prototypes/fowler-notation-preview.html)。


## 4. Type Generalization（类型泛化）

书中的Type Generalization（类型泛化）规则与大多数编程语言的“继承”/“接口”不一样，而是更接近真实情况。

这个举个例子，Person（人） 是个 Type。对于人有多种sub-type划分，比如按性别和职业等。于是，一种sub-type是 Male 和 Female，另一种sub-type 是 Docter, Policeman, Farmer ... 其中，第一种sub-type 是 Complete 划分，而第二种sub-type 是 Incomplete 划分。

另外，Type 可以**递归**和**嵌套**，即自己可以是自己的sub-type，而某个sub-type还可以继续有自己的sub-type。

关于 Type generalization 的视觉效果，参考 [类型泛化](./prototypes/generalization-preview.html)。

## 5. 短语义评论（Short Semantic Statements）

Semantic Statements是对上述符号无法表述的语义信息的补充，分为Short Semantic Statements 和 Long Semantic Statements。本节关于 Short Semantic Statements ，下一节关注 Long Semantic Statements。

下面的表格汇总了短语义评论。第一列是 短语义评论 的目标，第二列是 短语义评论 ，第三列是 短语义评论 的含义。

| Attached To Element | Semantic Stat | Description                             | Remark |
|---------------------|---------------------|-----------------------------------------|-----|
| Type                |   [abstract]  | 该类型不能有直接实例，必须通过子类实例化      |  |
| Mapping             |   [abstract]  | 该关系是抽象的，必须由子域的具体实现来覆盖    ||
| Mapping             |      [imm]    | 关系一旦建立，不可更改 | |
| Type Generalization |      [imm]    | 静态子类型，对象在该划分内不能改变类型 ||
| Type                | [singleton]   | 表示该类在全局只能有一个实例 | |
| Mapping             |     [list]    | 表示返回的是一个有序集合     | 仅用于多值Mapping |
| Mapping             |    [class]    | 表示该关系属于"类"本身（类似静态成员），而非属于某个具体实例||
| Mapping             | [key: a type] | 表示这是一个限定映射（Keyed Mapping） ||
| Association         | [hierarchy]   | 对象间形成树状层次结构      | 仅用于递归的association |
| Mapping             | [hierarchy]   | 返回的是一个层次结构对象 | 仅用于多值Mapping |
| Association         | [dag]         | 形成有向无环图（Directed Acyclic Graph），允许有多个父节点但不能成环 | 仅用于递归的association |
| Association         | [multiple hierarchies] | 表示存在多个并行的层次结构 | 仅用于递归的association |
| Mapping | [historic] | 表示需要维护连接的历史痕迹 | 仅用于历史Mapping（需要进一步考察什么是历史Mapping）|

另外，一个Element可以有多个Short Semantic Statement。

具体的视觉效果参考 [Short Semantic Statements](./docs/prototypes/short-semantic-preview.html)。


## 6. 长语义评论（Long Semantic Statements）

当规则无法用一个单词概括时，使用"折角便签"符号，根据以下标题开头：

|  Attached To Element  | Semantic Stat | Description | 
|-----------------------|---------------|--------------------------------------|
| Type                  | Constraint    | 必须对该类型所有实例都为真的断言（业务规则）|
| Association (derived) | Derivation    | 描述该映射是如何计算出来的逻辑（实现时可替换）|
| Any Element           |  Note         | 非正式的、描述性的注释 |                        

具体的视觉效果参考 [Long Semantic Statements](./docs/prototypes/long-semantic-preview.html)。



