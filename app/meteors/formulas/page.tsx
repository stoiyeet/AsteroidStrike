// app/meteors/formulas/page.tsx
import { Suspense } from 'react';
import FormulasPageClient from './FormulasPageInner';

export default function FormulasPageWrapper() {
  return (
    <Suspense fallback={<div>Loading formulas...</div>}>
      <FormulasPageClient />
    </Suspense>
  );
}
