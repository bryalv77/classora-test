import { createBrowserRouter, Navigate } from 'react-router';
import { TicketsPage } from '@/features/tickets/pages/TicketsPage';

export const router = createBrowserRouter([
  { path: '/tickets', element: <TicketsPage /> },
  { path: '*', element: <Navigate to="/tickets" replace /> },
], { basename: import.meta.env.BASE_URL });
