import {AppHero} from '@/components/app-hero';
import {PromptForm} from '../prompt/prompt-form';

export function DashboardFeature() {
  return (
    <div>
      <AppHero title="Cryptonite" subtitle="Your new AI assistant for crypto." />
      <PromptForm />
    </div>
  );
}
