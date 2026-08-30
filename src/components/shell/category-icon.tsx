import {
  Activity,
  Bot,
  Brain,
  Cpu,
  Database,
  FileText,
  FlaskConical,
  Globe,
  Layers,
  LineChart,
  Plug,
  Server,
  Settings,
  Shapes,
  Shield,
  Wallet,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

/**
 * Explicit map rather than a dynamic import: the set of offered icons is small
 * and fixed (see CATEGORY_ICONS), and this keeps them in the server bundle.
 */
const ICONS: Record<string, LucideIcon> = {
  brain: Brain,
  workflow: Workflow,
  activity: Activity,
  server: Server,
  database: Database,
  'line-chart': LineChart,
  shield: Shield,
  wallet: Wallet,
  bot: Bot,
  cpu: Cpu,
  globe: Globe,
  layers: Layers,
  plug: Plug,
  'flask-conical': FlaskConical,
  'file-text': FileText,
  settings: Settings,
};

export function CategoryIcon({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  const Icon = (name && ICONS[name]) || Shapes;
  return <Icon className={className} />;
}
