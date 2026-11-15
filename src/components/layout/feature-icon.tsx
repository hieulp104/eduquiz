import {
  BookMarked,
  BookOpen,
  CircleHelp,
  FileText,
  Folder,
  Handshake,
  House,
  Info,
  Landmark,
  Layers,
  Lightbulb,
  PencilRuler,
  School,
  Search,
  Settings,
  Trash2,
  UserCog,
  Users,
  Video,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import type { FeatureIcon as FeatureIconName } from "@/config/navigation";

const ICONS: Record<FeatureIconName, LucideIcon> = {
  home: House,
  assignment: FileText,
  exam: Folder,
  class: Layers,
  teacher: Users,
  content: BookOpen,
  questionBank: Landmark,
  course: BookMarked,
  ai: WandSparkles,
  account: UserCog,
  tip: Lightbulb,
  feedback: PencilRuler,
  live: Video,
  search: Search,
  school: School,
  partner: Handshake,
  settings: Settings,
  info: Info,
  trash: Trash2,
  help: CircleHelp,
};

export function FeatureIcon({ name, className }: { name: FeatureIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}
