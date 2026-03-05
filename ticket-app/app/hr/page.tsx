import { TicketList } from "@/components/tickets/TicketList";

export default function HRPage() {
  return (
    <TicketList
      apiEndpoint="/api/hr/tickets"
      title="人事ヘルプデスク"
      accentColor="green"
    />
  );
}
