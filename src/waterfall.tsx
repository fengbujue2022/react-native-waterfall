import React from "react";
import {
  View,
  Text,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleProp,
  ImageStyle,
  ScrollViewProps,
  Animated,
  LayoutChangeEvent,
  StyleSheet,
  RefreshControl,
  RefreshControlPropsIOS,
  RefreshControlPropsAndroid,
  ActivityIndicator,
} from "react-native";

export type WaterfallProps<TItem> = {
  columnCount: number;
  columnGap?: number;
  itemInfoData: ItemInfo<TItem>[];
  bufferAmount?: number;
  renderItem: (
    itemInfo: ItemInfo<TItem>,
    columnWidth: number,
    index: number
  ) => React.ReactNode;
  renderLoadMore?: () => React.ReactNode;
  onInitData: (columnWidth: number) => Promise<void>;
  onInfinite?: (columnWidth: number) => Promise<void>;
  onRefresh?: (columnWidth: number) => Promise<void>;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  refreshControlProps?: RefreshControlPropsIOS & RefreshControlPropsAndroid;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ImageStyle>;
} & ScrollViewProps;

type State = {
  columnWidth: number;
  offset: number;
  isRefreshing: boolean;
  isLoading: boolean;
};

export type ItemInfo<TItem> = {
  size: number;
  item: TItem;
};

export default class Waterfall<TItem = any> extends React.Component<
  WaterfallProps<TItem>,
  State
> {
  static defaultProps: Partial<WaterfallProps<any>> = {
    columnGap: 0,
    bufferAmount: 10,
    renderLoadMore: () => (
      <View style={styles.loadingMoreBox}>
        <ActivityIndicator
          style={styles.loadingMoreIndicator}
          size="small"
          color="black"
        />
        <Text>{"loading"}</Text>
      </View>
    ),
  };

  scrollOffset = new Animated.Value(0);
  itemsRunwayOffset = new Animated.Value(0);

  scrollHeight = 0;
  scrollWidth = 0;
  lastMeasuredIndex = -1;

  itemPositions: Array<{ offsetLeft: number; offsetTop: number }> = [];
  itemOffsetTops: Array<number> = [];

  constructor(props: WaterfallProps<TItem>) {
    super(props);
    this.itemOffsetTops = Array(this.props.columnCount).fill(0);
    const state: State = {
      offset: 0,
      columnWidth: 0,
      isRefreshing: false,
      isLoading: false,
    };
    this.state = state;
  }

  getColumnWidth = () => {
    return this.state.columnWidth;
  };

  private onScroll = ({
    nativeEvent: {
      contentOffset: { y },
      layoutMeasurement: { height },
      contentSize: { height: contentHeight },
    },
  }: NativeSyntheticEvent<NativeScrollEvent>) => {
    this.setState({ offset: y });
    if (
      y + height >= contentHeight - 20 &&
      this.lastMeasuredIndex === this.props.itemInfoData.length - 1
    ) {
      this.onInfinite();
    }
  };

  private onRefresh = () => {
    this.setState({ isRefreshing: true });
    return this.props.onRefresh!(this.state.columnWidth).finally(() => {
      this.lastMeasuredIndex = -1;
      this.itemPositions = [];
      this.itemOffsetTops = Array(this.props.columnCount).fill(0);
      this.setState({ isRefreshing: false });
    });
  };

  private onInfinite = () => {
    this.setState({ isLoading: true });
    return this.props.onInfinite!(this.state.columnWidth).finally(() => {
      this.setState({ isLoading: false });
    });
  };

  private onItemsBoxLayout = ({
    nativeEvent: {
      layout: { width, height },
    },
  }: LayoutChangeEvent) => {
    if (this.scrollWidth !== width) {
      const { columnCount, columnGap, itemInfoData } = this.props;

      this.scrollWidth = width;
      this.scrollHeight = height;
      const newColumnWidth =
        (width - (columnCount - 1) * columnGap!) / columnCount;
      if (!itemInfoData?.length) {
        this.onInitData(newColumnWidth);
      }
      this.setState({
        columnWidth: newColumnWidth,
      });
    }
  };

  private onInitData = (columnWidth: number) => {
    this.setState({ isRefreshing: true });
    return this.props.onInitData(columnWidth).finally(() => {
      this.setState({ isRefreshing: false });
    });
  };

  private getOffsetColumn(predicate: (a: number, b: number) => boolean) {
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
    return this.getOffsetColumn((a, b) => a <= b);
  }

  getHighestOffsetColumn() {
    return this.getOffsetColumn((a, b) => a >= b);
  }

  evaluateVisibleRange() {
    let { offset } = this.state;
    const { itemInfoData, bufferAmount } = this.props;
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

    if (bufferAmount) {
      start = Math.max(0, start - bufferAmount);
      end = Math.min(end + bufferAmount, itemCount - 1);
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
      const middle = minIndex + Math.floor((maxIndex - minIndex) / 2);
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
    const { columnGap, itemInfoData } = this.props;
    const { columnWidth } = this.state;
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
    const {
      renderItem,
      renderLoadMore,
      itemInfoData,
      onScroll,
      onRefresh,
      onInfinite,
      style,
      containerStyle,
      refreshControlProps,
      ...rest
    } = this.props;
    const { columnWidth, isLoading } = this.state;
    const items: React.ReactNodeArray = [];

    if (columnWidth && itemInfoData.length) {
      const [start, end] = this.evaluateVisibleRange();

      for (let i = start; i <= end; i++) {
        const posistion = this.getPositionForIndex(i);
        items.push(
          <View
            key={i}
            style={{
              ...styles.item,
              top: posistion.offsetTop,
              left: posistion.offsetLeft,
              width: columnWidth,
              height: itemInfoData[i].size,
            }}
          >
            {renderItem(itemInfoData[i], columnWidth, i)}
          </View>
        );
      }

      const runwayOffset = this.getHighestOffsetColumn()[1];
      this.itemsRunwayOffset.setValue(runwayOffset);
    }

    return (
      <View style={styles.container}>
        <Animated.ScrollView
          style={style}
          bounces={false}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            this.onScroll(e);
            onScroll?.call(undefined, e);
          }}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={this.state.isRefreshing}
                onRefresh={this.onRefresh}
                {...refreshControlProps}
              />
            ) : undefined
          }
          scrollEventThrottle={20}
          {...(rest as any)}
        >
          <Animated.View style={[styles.container, containerStyle]}>
            <Animated.View
              style={{ height: this.itemsRunwayOffset }}
              onLayout={this.onItemsBoxLayout}
            >
              {items}
            </Animated.View>
          </Animated.View>
          {!!onInfinite && isLoading && renderLoadMore?.call(undefined)}
        </Animated.ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  item: {
    position: "absolute",
  },
  loadingMoreBox: {
    flexDirection: "row",
    justifyContent: "center",
    padding: 20,
  },
  loadingMoreIndicator: {
    marginRight: 10,
  },
});
