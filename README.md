# react-native-waterfall

tiny & virtualized waterfall layout component

## Getting started

`$ npm install react-native-virtualized-waterfall --save`

## Usage

```Typescript
import Waterfall from "react-native-virtualized-waterfall";


fetchItems(columnWidth:number) {
  //...fetch data and mapping to itemInfo
}

render(){
  return
    <Waterfall
        onInitData={(columnWidth) => this.fetchItems(columnWidth)}
        columnCount={2}
        columnGap={this.columnGap}
        itemInfoData={this.items}
        bufferAmount={10}
        renderItem={(
          {
            item,
            size,
          }: {
            item: any;
            size: number;
          },
          columnWidth: number,
        ) => {
          const ratio = 1;
          return (
              <FastImage
                style={{
                  height: size,
                  width: ratio * size,
                }}
                {...}
              />
          );
        }}
        onRefresh={(columnWidth) => {
          this.pageNum = 1;
          return this.fetchItems(columnWidth, true);
        }}
        onInfinite={(columnWidth) => this.fetchItems(columnWidth)} />
}
```
