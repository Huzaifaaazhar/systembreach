export interface AnomalyProps {
  onFound: () => void;
  onWrong: (why: string) => void;
}
