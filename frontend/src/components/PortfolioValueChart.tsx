import NavChart from './NavChart';
import type { NavPrice } from '../types';

interface Props {
  navHistory: NavPrice[];
}

/**
 * Thin wrapper used by PortfolioDetail.
 * Delegates to the shared NavChart component.
 */
export default function PortfolioValueChart({ navHistory }: Props) {
  return <NavChart navHistory={navHistory} />;
}
