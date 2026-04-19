import { useState, useEffect } from 'react';

// 断点对应的列数：与 Tailwind sm/lg/xl/2xl 保持一致
const getGridColumns = (width: number) => {
  if (width >= 1536) return 5;
  if (width >= 1280) return 4;
  if (width >= 1024) return 3;
  if (width >= 640) return 2;
  return 1;
};

// 随视口宽度变化输出当前列数，供"结构化首页"决定每个分区展示数量
export const useGridColumns = () => {
  const [gridColumns, setGridColumns] = useState(() => getGridColumns(window.innerWidth));
  useEffect(() => {
    const handleResize = () => setGridColumns(getGridColumns(window.innerWidth));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return gridColumns;
};
