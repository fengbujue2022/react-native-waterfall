# react-native-waterfall

tiny & virtualized waterfall layout component

## Getting started

`$ npm install react-native-virtualized-waterfall --save`

## Usage

```javascript
import Waterfall from "react-native-virtualized-waterfall";


fetchItems(){
  //...
}

render(){
  return 
    <Waterfall
        onInitData={(columnWidth) => this.fetchItems(columnWidth)}
        columnCount={2}
        columnGap={this.columnGap}
        itemInfoData={this.items}
        bufferAmount={10}
        bounces={true}
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
