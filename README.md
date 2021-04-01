# react-native-waterfall

a virtualized & infinite waterfall layout component for React-Native

## Getting started

`npm i react-native-virtualized-waterfall`

or

`yarn add react-native-virtualized-waterfall`

## Preview

[online-demo](https://codesandbox.io/s/waterfall-demo-rxkww?file=/src/App.tsx "Heading link")

related project: [h.bilibli-rn](https://github.com/Feng-Bu-Jue/h.bilibili-rn "Heading link")

![h.bilibili](https://i.loli.net/2020/09/02/mFa6XNckYn5UAvK.gif)

## Props

please refer to type definition

\*This project layout through known item height,so you must got item size before render

## Usage

```Typescript
import Waterfall from "react-native-virtualized-waterfall";

<Waterfall
    columnNum={2}
    columnGap={this.columnGap}
    itemInfos={this.items}
    bufferAmount={10}
    heightGetter={this.heightGetter.bind(this)}
    renderItem={(
      itemInfo,
      width,
      index
    ) => {
      return (
          <Image
            style={{
              height: this.heightGetter(width,index),
              width: width,
            }}
            {...}
          />
      );
    }}
    onRefresh={() => {
      this.pageNum = 1;
      return this.fetchItems(true);
    }}
    onInfinite={() => this.fetchItems()} />
```
