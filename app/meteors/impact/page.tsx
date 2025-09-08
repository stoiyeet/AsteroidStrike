// app/meteors/impact/page.tsx
import { Suspense } from 'react';
import ImpactPageClient from './ImpactPageClient';

export default function ImpactPageWrapper() {
  return (
    <Suspense fallback={<div>Loading impact data...</div>}>
      <ImpactPageClient />
    </Suspense>
  );
}
