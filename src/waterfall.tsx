import React from "react";
import {
  View,
  Text,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleProp,
  ViewStyle,
  ScrollViewProps,
  Animated,
  LayoutChangeEvent,
  StyleSheet,
  RefreshControl,
  RefreshControlPropsIOS,
  RefreshControlPropsAndroid,
  ActivityIndicator,
  ScrollView,
} from "react-native";

export interface WaterfallProps<TItem> extends ScrollViewProps {
  columnNum: number;
  columnGap?: number;
  itemInfos: TItem[];
  bufferAmount?: number;
  infiniteThreshold?: number;
  heightGetter: (width: number, index: number) => number;
  renderItem: (
    itemInfo: TItem,
    width: number,
    height: number,
    index: number
  ) => React.ReactNode;
  renderLoadMore?: (isLoading: boolean) => React.ReactNode;
  HeaderComponent?: React.ComponentType<any> | React.ReactElement;
  FooterComponent?: React.ComponentType<any> | React.ReactElement;
  onInfinite?: () => Promise<void>;
  onRefresh?: () => Promise<void>;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  refreshControlProps?: RefreshControlPropsIOS & RefreshControlPropsAndroid;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

type State = {
  columnWidth: number;
  offset: number;
  refreshing: boolean;
  loading: boolean;
};

export default class Waterfall<TItem = any> extends React.Component<
  WaterfallProps<TItem>,
  State
> {
  static defaultProps = {
    columnGap: 0,
    bufferAmount: 10,
    infiniteThreshold: 50,
    renderLoadMore: (loading: boolean) => (
      <View
        style={[
          styles.loadingMoreBox,
          // eslint-disable-next-line react-native/no-inline-styles
          loading ? { opacity: 1 } : { opacity: 0 },
        ]}
      >
        <ActivityIndicator
          style={styles.loadingMoreIndicator}
          size="small"
          color="black"
        />
        <Text>{"loading"}</Text>
      </View>
    ),
  };

  scrollViewRef = React.createRef<ScrollView>();
  scrollOffset = new Animated.Value(0);
  itemsRunwayOffset = new Animated.Value(0);

  scrollHeight?: number;
  itemsRunwayWidth = 0;
  lastMeasuredIndex = -1;

  itemPositions: Array<{ offsetLeft: number; offsetTop: number }> = [];
  itemOffsetTops: Array<number> = [];

  constructor(props: WaterfallProps<TItem>) {
    super(props);
    this.itemOffsetTops = Array(this.props.columnNum).fill(0);
    const state: State = {
      offset: 0,
      columnWidth: 0,
      refreshing: false,
      loading: false,
    };
    this.state = state;
  }

  getColumnWidth = () => {
    return this.state.columnWidth;
  };

  reset = () => {
    this.lastMeasuredIndex = -1;
    this.itemPositions = [];
    this.itemOffsetTops = Array(this.props.columnNum).fill(0);
  };

  scrollTo = (
    y?: number | { x?: number; y?: number; animated?: boolean },
    x?: number,
    animated?: boolean
  ): void => {
    this.scrollViewRef.current?.scrollTo(y, x, animated);
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
      y + height >= contentHeight - this.props.infiniteThreshold! &&
      this.lastMeasuredIndex === this.props.itemInfos.length - 1 &&
      !this.state.refreshing &&
      !this.state.loading &&
      this.props.onInfinite
    ) {
      this.onInfinite();
    }
  };

  private onRefresh = () => {
    this.setState({ refreshing: true });
    return this.props.onRefresh!().finally(() => {
      this.reset();
      this.setState({ refreshing: false });
    });
  };

  private onInfinite = () => {
    this.setState({ loading: true });
    return this.props.onInfinite!().finally(() => {
      this.setState({ loading: false });
    });
  };

  private onScrollLayout = ({
    nativeEvent: {
      layout: { height },
    },
  }: LayoutChangeEvent) => {
    if (this.scrollHeight !== height) {
      this.scrollHeight = height;
    }
  };

  private onItemsRunwayLayout = ({
    nativeEvent: {
      layout: { width },
    },
  }: LayoutChangeEvent) => {
    if (this.itemsRunwayWidth !== width) {
      const { columnNum, columnGap } = this.props;

      this.itemsRunwayWidth = width;
      const newColumnWidth = (width - (columnNum - 1) * columnGap!) / columnNum;

      this.reset();
      this.setState({
        columnWidth: newColumnWidth,
      });
    }
  };

  private getOffsetColumn(
    predicate: (a: number, b: number) => boolean
  ): [number, number] {
    let index: undefined | number;
    let value: undefined | number;
    this.itemOffsetTops.forEach((item, i) => {
      if (
        (index === undefined && value === undefined) ||
        predicate(item, value!)
      ) {
        value = item;
        index = i;
      }
    });
    return [index || 0, value || 0];
  }

  getLowestOffsetColumn() {
    return this.getOffsetColumn((p, c) => p < c);
  }

  getHighestOffsetColumn() {
    return this.getOffsetColumn((p, c) => p > c);
  }

  evaluateVisibleRange() {
    let { offset, columnWidth } = this.state;
    const { itemInfos, bufferAmount, heightGetter } = this.props;
    const maxOffset = offset + this.scrollHeight! * 1.5;
    const itemCount = itemInfos.length;
    let start = 0;

    const lastMeasuredOffset =
      this.lastMeasuredIndex >= 0
        ? this.getPositionForIndex(this.lastMeasuredIndex).offsetTop
        : 0;
    const lastMeasuredIndex = Math.max(0, this.lastMeasuredIndex);

    const compare = (i: number) =>
      this.getPositionForIndex(i).offsetTop <= offset;

    if (lastMeasuredOffset >= offset) {
      start = this.binarySearch({
        minIndex: 0,
        maxIndex: lastMeasuredIndex,
        compare,
      });
    } else {
      start = this.exponentialSearch({
        arrayLength: itemCount,
        index: lastMeasuredIndex,
        compare,
      });
    }
    offset =
      this.getPositionForIndex(start).offsetTop +
      heightGetter(columnWidth, start);

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
    const { columnGap, heightGetter } = this.props;
    const { columnWidth } = this.state;
    if (index > this.lastMeasuredIndex) {
      for (let i = this.lastMeasuredIndex + 1; i <= index; i++) {
        const [columnIndex, columnOffset] = this.getLowestOffsetColumn();
        this.itemPositions[i] = {
          offsetLeft: (columnWidth + columnGap!) * columnIndex,
          offsetTop: columnOffset,
        };
        this.itemOffsetTops[columnIndex] =
          columnOffset + heightGetter(columnWidth, i);
        this.lastMeasuredIndex = i;
      }
    }
    return this.itemPositions[index];
  }

  render() {
    const {
      renderItem,
      renderLoadMore,
      HeaderComponent,
      FooterComponent,
      itemInfos,
      heightGetter,
      onScroll,
      onRefresh,
      onInfinite,
      style,
      containerStyle,
      refreshControlProps,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      children,
      ...rest
    } = this.props;
    const { columnWidth, loading, refreshing } = this.state;
    const items: React.ReactNodeArray = [];
    if (columnWidth && this.scrollHeight !== undefined && itemInfos.length) {
      const [start, end] = this.evaluateVisibleRange();

      for (let i = start; i <= end; i++) {
        const position = this.getPositionForIndex(i);
        items.push(
          <View
            key={i}
            // eslint-disable-next-line react-native/no-inline-styles
            style={{
              position: "absolute",
              top: position.offsetTop,
              left: position.offsetLeft,
              width: columnWidth,
              height: heightGetter(columnWidth, i),
            }}
          >
            {renderItem(
              itemInfos[i],
              columnWidth,
              heightGetter(columnWidth, i),
              i
            )}
          </View>
        );
      }
      const runwayOffset = this.getHighestOffsetColumn()[1];
      this.itemsRunwayOffset.setValue(runwayOffset);
    }

    return (
      <View style={[styles.container]}>
        <ScrollView
          ref={this.scrollViewRef}
          style={style}
          bounces={false}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            this.onScroll(e);
            onScroll?.call(undefined, e);
          }}
          onLayout={this.onScrollLayout}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={this.onRefresh}
                {...refreshControlProps}
              />
            ) : undefined
          }
          scrollEventThrottle={20}
          {...(rest as any)}
        >
          {HeaderComponent}
          {this.scrollHeight !== undefined && (
            <Animated.View style={[styles.container, containerStyle]}>
              <Animated.View
                style={[{ height: this.itemsRunwayOffset }, containerStyle]}
                onLayout={this.onItemsRunwayLayout}
              >
                {items}
              </Animated.View>
              {!!onInfinite && renderLoadMore?.call(undefined, loading)}
            </Animated.View>
          )}
          {FooterComponent}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingMoreBox: {
    flexDirection: "row",
    justifyContent: "center",
    padding: 20,
  },
  loadingMoreIndicator: {
    marginRight: 10,
  },
});
