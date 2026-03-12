import { AgentToggle } from './components/AgentToggle';
import { PersonalityEditor } from './components/PersonalityEditor';
import { StatsCards } from './components/StatsCards';
import { InteractionLog } from './components/InteractionLog';
import { GroupSelector } from './components/GroupSelector';

export const metadata = {
  title: 'Agente IA - Dispara v2',
  description: 'Gerencie o agente de IA para seus grupos',
};

export default function AgentDashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agente IA</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure e monitore o agente de IA nos seus grupos
          </p>
        </div>
        <AgentToggle />
      </div>

      {/* Stats */}
      <StatsCards />

      {/* Config Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PersonalityEditor />
        <GroupSelector />
      </div>

      {/* Interaction Log */}
      <InteractionLog />
    </div>
  );
}
