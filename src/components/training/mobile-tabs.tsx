"use client";

import type { ReactElement, ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type MobileTabsProps = {
  terminal: ReactNode;
  network: ReactNode;
  attack: ReactNode;
  events: ReactNode;
  mentor: ReactNode;
};

export function TrainingMobileTabs({
  terminal,
  network,
  attack,
  events,
  mentor,
}: MobileTabsProps): ReactElement {
  return (
    <div className="flex min-h-0 flex-1 w-full flex-col">
      <Tabs defaultValue="terminal" className="flex h-full min-h-0 w-full flex-col">
        <TabsList className="grid w-full grid-cols-5 bg-slate-900">
          <TabsTrigger value="terminal" className="text-[10px]">
            Terminal
          </TabsTrigger>
          <TabsTrigger value="network" className="text-[10px]">
            Network
          </TabsTrigger>
          <TabsTrigger value="attack" className="text-[10px]">
            Threats
          </TabsTrigger>
          <TabsTrigger value="events" className="text-[10px]">
            Events
          </TabsTrigger>
          <TabsTrigger value="mentor" className="text-[10px]">
            Mentor
          </TabsTrigger>
        </TabsList>
        <TabsContent value="terminal" className="mt-0 min-h-0 flex-1 overflow-hidden p-2 data-[state=active]:flex data-[state=active]:flex-col">
          {terminal}
        </TabsContent>
        <TabsContent value="network" className="mt-0 min-h-0 flex-1 overflow-hidden p-2 data-[state=active]:flex data-[state=active]:flex-col">
          {network}
        </TabsContent>
        <TabsContent value="attack" className="mt-0 min-h-0 flex-1 overflow-hidden p-2 data-[state=active]:flex data-[state=active]:flex-col">
          {attack}
        </TabsContent>
        <TabsContent value="events" className="mt-0 min-h-0 flex-1 overflow-hidden p-2 data-[state=active]:flex data-[state=active]:flex-col">
          {events}
        </TabsContent>
        <TabsContent value="mentor" className="mt-0 min-h-0 flex-1 overflow-hidden p-2 data-[state=active]:flex data-[state=active]:flex-col">
          {mentor}
        </TabsContent>
      </Tabs>
    </div>
  );
}
