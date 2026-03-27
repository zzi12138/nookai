export type BoardCategory =
  | 'Ambient lighting'
  | 'Bedding & soft textiles'
  | 'Floor soft furnishings'
  | 'Wall decor'
  | 'Plants'
  | 'Functional accessories';

export type BoardCell = {
  index: number;
  row: number;
  col: number;
  left: number;
  top: number;
  width: number;
  height: number;
  leftPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
};

export const ITEMS_BOARD_CONFIG = {
  width: 2400,
  height: 1800,
  columns: 4,
  rows: 3,
  paddingX: 80,
  paddingY: 80,
  gapX: 40,
  gapY: 40,
} as const;

export const CATEGORY_SLOT_RANGES: Record<BoardCategory, number[]> = {
  'Ambient lighting': [1, 2],
  'Bedding & soft textiles': [3, 4],
  'Floor soft furnishings': [5],
  'Wall decor': [6, 7],
  Plants: [8, 9],
  'Functional accessories': [10, 11, 12],
};

let boardCellsCache: BoardCell[] | null = null;

export function getFixedBoardCells() {
  if (boardCellsCache) return boardCellsCache;

  const {
    width,
    height,
    columns,
    rows,
    paddingX,
    paddingY,
    gapX,
    gapY,
  } = ITEMS_BOARD_CONFIG;
  const cellWidthPx = (width - paddingX * 2 - gapX * (columns - 1)) / columns;
  const cellHeightPx = (height - paddingY * 2 - gapY * (rows - 1)) / rows;

  const cells: BoardCell[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const index = row * columns + col + 1;
      const leftPx = paddingX + col * (cellWidthPx + gapX);
      const topPx = paddingY + row * (cellHeightPx + gapY);
      cells.push({
        index,
        row: row + 1,
        col: col + 1,
        leftPx,
        topPx,
        widthPx: cellWidthPx,
        heightPx: cellHeightPx,
        left: (leftPx / width) * 100,
        top: (topPx / height) * 100,
        width: (cellWidthPx / width) * 100,
        height: (cellHeightPx / height) * 100,
      });
    }
  }

  boardCellsCache = cells;
  return cells;
}

export function getBoardCellBySlot(slotIndex: number) {
  const cells = getFixedBoardCells();
  const safeIndex = Number.isFinite(slotIndex) ? Math.max(1, Math.min(12, Math.round(slotIndex))) : 1;
  return cells[safeIndex - 1];
}

export function getDefaultBoardCellForIndex(index: number) {
  const cells = getFixedBoardCells();
  const safe = Math.max(0, Math.floor(index));
  return cells[safe % cells.length];
}

export function assignItemsToBoardCells<T extends { category: BoardCategory }>(items: T[]) {
  const cells = getFixedBoardCells();
  const available = new Set(cells.map((cell) => cell.index));

  const takeSlot = (category: BoardCategory) => {
    const preferred = CATEGORY_SLOT_RANGES[category] || [];
    for (const slot of preferred) {
      if (available.has(slot)) {
        available.delete(slot);
        return slot;
      }
    }

    for (const cell of cells) {
      if (available.has(cell.index)) {
        available.delete(cell.index);
        return cell.index;
      }
    }

    return null;
  };

  return items.map((item, index) => {
    const slot = takeSlot(item.category);
    const boardCell = slot ? getBoardCellBySlot(slot) : getDefaultBoardCellForIndex(index);
    return {
      ...item,
      boardCell,
    };
  });
}
