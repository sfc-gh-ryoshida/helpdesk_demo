import { TicketList } from "@/components/tickets/TicketList";

export default function FinancePage() {
  return (
    <TicketList
      apiEndpoint="/api/finance/tickets"
      title="経理ヘルプデスク"
      accentColor="purple"
    />
  );
}
