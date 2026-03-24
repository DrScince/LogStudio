declare module 'react-window' {
  import React from 'react';

  interface ListChildComponentProps {
    index: number;
    style: React.CSSProperties;
    data?: unknown;
  }

  interface VariableSizeListProps {
    children: React.ComponentType<ListChildComponentProps>;
    height: number;
    itemCount: number;
    itemSize: (index: number) => number;
    width: number | string;
    className?: string;
    style?: React.CSSProperties;
    onScroll?: (params: { scrollOffset: number; scrollDirection: string; scrollUpdateWasRequested: boolean }) => void;
    overscanCount?: number;
    initialScrollOffset?: number;
    itemData?: unknown;
    onItemsRendered?: (params: { overscanStartIndex: number; overscanStopIndex: number; visibleStartIndex: number; visibleStopIndex: number }) => void;
  }

  interface VariableSizeListHandles {
    scrollTo(scrollOffset: number): void;
    scrollToItem(index: number, align?: 'auto' | 'smart' | 'center' | 'end' | 'start'): void;
    resetAfterIndex(index: number, shouldForceUpdate?: boolean): void;
  }

  export const VariableSizeList: React.ForwardRefExoticComponent<
    VariableSizeListProps & React.RefAttributes<VariableSizeListHandles>
  >;
}
