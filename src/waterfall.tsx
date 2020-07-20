import React from "react";
import {
  View,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";

type Props<TItem> = {
  columnWidth: number;
  columnGap?: number;
  itemInfoData: ItemInfo<TItem>[];
  overViewCount?: number;
  renderItem: (itemInfo: ItemInfo<TItem>, index: number) => React.ReactNode;
};

type State = {
  columnCount: number;
  offset: number;
};

type ItemInfo<TItem> = {
  size: number;
  item: TItem;
};

export default class Waterfall<TItem = any> extends React.Component<
  Props<TItem>,
  State
> {
  static defaultProps: Partial<Props<any>> = {
    columnGap: 0,
    overViewCount: 10,
  };

  scrollHeight = 0;
  scrollWidth = 0;
  lastMeasuredIndex = -1;

  itemPositions: Array<{ offsetLeft: number; offsetTop: number }> = [];
  itemOffsetTops: Array<number> = [];

  constructor(props: Props<TItem>) {
    super(props);
    this.state = { offset: 0, columnCount: 0 } as State;
  }

  onScroll = ({
    nativeEvent: {
      contentOffset: { y },
    },
  }: NativeSyntheticEvent<NativeScrollEvent>) => {
    this.setState({ offset: y });
  };

  _getOffsetColumn(predicate: (a: number, b: number) => boolean) {
    let index = 0;
    let value = 0;
    if (this.itemOffsetTops.length) {
      value = this.itemOffsetTops.reduce((p, c, i) => {
        if (predicate(p, c)) {
          index = i - 1;
          return p;
        } else {
          index = i;
          return c;
        }
      });
    }
    return [index, value];
  }

  getLowestOffsetColumn() {
    return this._getOffsetColumn((a, b) => a <= b);
  }

  getHighestOffsetColumn() {
    return this._getOffsetColumn((a, b) => a >= b);
  }

  evaluateVisableRange() {
    let { offset } = this.state;
    const { itemInfoData, overViewCount } = this.props;
    const maxOffset = offset + this.scrollHeight * 2;
    const itemCount = itemInfoData.length;
    let start = 0;

    const lastMeasuredOffset =
      this.lastMeasuredIndex >= 0
        ? this.getPositionForIndex(this.lastMeasuredIndex).offsetTop
        : 0;

    const compare = (i: number) =>
      this.getPositionForIndex(i).offsetTop <= offset;

    if (lastMeasuredOffset >= offset) {
      start = this.binarySearch({
        minIndex: 0,
        maxIndex: this.lastMeasuredIndex,
        compare,
      });
    } else {
      start = this.exponentialSearch({
        arrayLength: itemCount,
        index: this.lastMeasuredIndex,
        compare,
      });
    }

    offset =
      this.getPositionForIndex(start).offsetTop + itemInfoData[start].size;

    let end = start;
    while (offset < maxOffset && end < itemCount - 1) {
      end++;
      offset = this.getPositionForIndex(end).offsetTop;
    }

    if (overViewCount) {
      start = Math.max(0, start - overViewCount);
      end = Math.min(end + overViewCount, itemCount - 1);
    }
    return [start, end];
  }

  private binarySearch({
    minIndex,
    maxIndex,
    compare,
  }: {
    minIndex: number;
    maxIndex: number;
    compare: (mid: number) => boolean;
  }) {
    while (maxIndex >= minIndex) {
      var middle = minIndex + Math.floor((maxIndex - minIndex) / 2);
      if (compare(middle)) {
        minIndex = middle + 1;
      } else {
        maxIndex = middle - 1;
      }
    }
    if (minIndex > 0) {
      return minIndex - 1;
    }
    //not found :)
    return 0;
  }

  private exponentialSearch({
    arrayLength,
    index,
    compare,
  }: {
    arrayLength: number;
    index: number;
    compare: (index: number) => boolean;
  }) {
    let interval = 1;
    while (index < arrayLength && compare(index)) {
      index += interval;
      interval *= 2;
    }
    return this.binarySearch({
      minIndex: Math.min(index, arrayLength - 1),
      maxIndex: Math.floor(index / 2),
      compare,
    });
  }

  getPositionForIndex(index: number) {
    const { columnWidth, columnGap, itemInfoData } = this.props;
    if (index > this.lastMeasuredIndex) {
      for (let i = this.lastMeasuredIndex + 1; i <= index; i++) {
        const [columnIndex, columnOffset] = this.getLowestOffsetColumn();
        this.itemPositions[i] = {
          offsetLeft: (columnWidth + columnGap!) * columnIndex,
          offsetTop: columnOffset,
        };
        this.itemOffsetTops[columnIndex] = columnOffset + itemInfoData[i].size;
        this.lastMeasuredIndex = i;
      }
    }
    return this.itemPositions[index];
  }

  render() {
    const { columnWidth, columnGap, itemInfoData, renderItem } = this.props;
    const { columnCount } = this.state;
    const items: React.ReactNodeArray = [];
    let scrollOffset = 0;
    if (columnCount) {
      if (!this.itemOffsetTops.length) {
        this.itemOffsetTops = Array(columnCount).fill(0);
      }
      const [start, end] = this.evaluateVisableRange();
      for (let i = start; i <= end; i++) {
        const posistion = this.getPositionForIndex(i);
        items.push(
          <View
            key={i}
            // eslint-disable-next-line react-native/no-inline-styles
            style={{
              position: "absolute",
              top: posistion.offsetTop,
              left: posistion.offsetLeft,
            }}
          >
            {renderItem(itemInfoData[i], i)}
          </View>
        );
      }
      scrollOffset = this.getHighestOffsetColumn()[1];
    }

    return (
      <View
        // eslint-disable-next-line react-native/no-inline-styles
        style={{ flex: 1 }}
        onLayout={({
          nativeEvent: {
            layout: { width, height },
          },
        }) => {
          if (this.scrollWidth !== width) {
            this.scrollWidth = width;
            this.scrollHeight = height;
            this.setState({
              columnCount: Math.floor(
                (width - columnGap!) / (columnWidth + columnGap!)
              ),
            });
          }
        }}
      >
        <ScrollView
          onScroll={this.onScroll}
          scrollEventThrottle={100}
          contentContainerStyle={{
            position: "relative",
            width: "100%",
            height: scrollOffset,
          }}
        >
          {items}
        </ScrollView>
      </View>
    );
  }
}
