import NavChart from './NavChart';
import type { NavPrice } from '../types';

interface Props {
  navHistory: NavPrice[];
}

/**
 * Thin wrapper used by InstrumentDetail.
 * Delegates to the shared NavChart component.
 */
export default function InstrumentValueChart({ navHistory }: Props) {
  return <NavChart navHistory={navHistory} />;
}
