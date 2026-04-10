import { Grid } from 'antd';

const { useBreakpoint } = Grid;

export const useIsMobile = (): boolean => {
  const screens = useBreakpoint();
  return !screens.md;
};
