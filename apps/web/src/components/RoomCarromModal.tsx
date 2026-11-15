import { CarromGameExperience } from "../features/carrom/CarromGameExperience.js";

interface RoomCarromModalProps {
  dark: boolean;
  open: boolean;
  onClose: () => void;
}

export function RoomCarromModal({ dark: _dark, open, onClose }: RoomCarromModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs sm:p-3"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="لعبة الكيرم"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full h-dvh sm:h-[94dvh] sm:max-w-[580px] sm:rounded-3xl sm:border sm:border-white/15 shadow-2xl overflow-hidden flex flex-col"
      >
        <CarromGameExperience onExit={onClose} exitLabel="إغلاق" />
      </div>
    </div>
  );
}

export default RoomCarromModal;
