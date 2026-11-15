import { CarromGameExperience } from "../features/carrom/CarromGameExperience.js";

interface CarromArenaPageProps {
  dark: boolean;
  onToggleTheme: () => void;
  onBackToChat: () => void;
}

export default function CarromArenaPage({
  dark: _dark,
  onToggleTheme: _onToggleTheme,
  onBackToChat,
}: CarromArenaPageProps) {
  return (
    <main className="h-dvh w-full overflow-hidden flex flex-col">
      <CarromGameExperience onExit={onBackToChat} exitLabel="العودة للدردشة" />
    </main>
  );
}
