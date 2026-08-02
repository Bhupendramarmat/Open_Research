import { BookOpen, Clock3, FlaskConical, GitBranch, Home, Mail, MessageCircle, Plus, SquareArrowOutUpRight, UserCircle2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecentItem {
  id: string;
  query: string;
}

interface ResearchSidebarProps {
  onNewThread: () => void;
  onHome: () => void;
  onHistory: () => void;
  onSelectRecent: (query: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  activeTab: "home" | "history";
  recentItems: RecentItem[];
}

const navItemClass =
  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-all duration-200";

const navIconClass =
  "h-12 w-12 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-all duration-200 inline-flex items-center justify-center";

const ResearchSidebar = ({
  onNewThread,
  onHome,
  onHistory,
  onSelectRecent,
  isOpen,
  onToggle,
  activeTab,
  recentItems,
}: ResearchSidebarProps) => {
  const isHomeActive = activeTab === "home";
  const isHistoryActive = activeTab === "history";

  return (
    <aside
      className={cn(
        "hidden lg:flex fixed left-0 top-0 h-screen border-r border-border/50 bg-card/70 backdrop-blur-xl z-30 transition-[width] duration-300 overflow-hidden",
        isOpen ? "w-[300px]" : "w-[150px]"
      )}
      id="app-sidebar"
      aria-expanded={isOpen}
    >
      <div className="w-full h-full flex flex-col min-h-0">
        <div className={cn("h-20 border-b border-border/50 grid", isOpen ? "grid-cols-[1fr_68px]" : "grid-cols-[80px_70px]")}>
          <div className={cn("flex items-center", isOpen ? "px-4 gap-3" : "justify-center")}>
            <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-subtle)" }}>
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            {isOpen && (
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">OpenResearch</p>
                <p className="text-[10px] text-muted-foreground leading-tight">Academic Workspace</p>
              </div>
            )}
          </div>

          <div className="border-l border-border/50 flex items-center justify-center">
            <button
              type="button"
              onClick={onToggle}
              className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors"
              aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {isOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {isOpen ? (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-4 split-pane-scroll">
              <button type="button" onClick={onNewThread} className="btn-primary-glow w-full flex items-center justify-center gap-2 py-2.5 text-[15px]">
                <Plus className="h-4 w-4" />
                New Thread
              </button>

              <nav className="space-y-1.5" aria-label="Primary">
                <button
                  type="button"
                  onClick={onHome}
                  className={cn(navItemClass, isHomeActive && "bg-secondary/80 text-foreground")}
                >
                  <Home className="h-4 w-4" />
                  Home
                </button>
                <button type="button" className={navItemClass}>
                  <BookOpen className="h-4 w-4" />
                  My Library
                </button>
                <button
                  type="button"
                  onClick={onHistory}
                  className={cn(navItemClass, isHistoryActive && "bg-secondary/80 text-foreground")}
                >
                  <Clock3 className="h-4 w-4" />
                  History
                </button>
              </nav>

              <div className="pt-3 border-t border-border/40">
                <p className="text-[11px] px-3 mb-2 uppercase tracking-wider text-muted-foreground/70 font-semibold">Recents</p>
                {recentItems.length > 0 ? (
                  <div className="space-y-1">
                    {recentItems.slice(0, 4).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectRecent(item.query)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors"
                        title={item.query}
                      >
                        <MessageCircle className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.query}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="px-3 text-xs text-muted-foreground/70">No recent threads yet.</p>
                )}
              </div>

              <div className="pt-3 border-t border-border/40">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-semibold px-3 mb-2">Tools</p>
                <div className="space-y-1.5">
                  <button type="button" className={navItemClass}>
                    <GitBranch className="h-4 w-4" />
                    Graph
                  </button>
                  <button type="button" className={navItemClass}>
                    <FlaskConical className="h-4 w-4" />
                    Demos
                    <SquareArrowOutUpRight className="h-3.5 w-3.5 ml-auto opacity-70" />
                  </button>
                  <button type="button" className={navItemClass}>
                    <Mail className="h-4 w-4" />
                    Contact
                    <SquareArrowOutUpRight className="h-3.5 w-3.5 ml-auto opacity-70" />
                  </button>
                </div>
              </div>
            </div>

            <div className="shrink-0 px-3 py-3 border-t border-border/40">
              <div className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-secondary/60 transition-colors">
                <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                  <UserCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">Research User</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">Local workspace</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-[80px_70px]">
            <div className="flex flex-col min-h-0 border-r border-border/50">
              <div className="flex-1 overflow-y-auto px-2 py-3 flex flex-col items-center gap-2 split-pane-scroll">
                <button type="button" onClick={onNewThread} className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground inline-flex items-center justify-center shadow-md shadow-primary/20 hover:brightness-110 transition-all" aria-label="New Thread">
                  <Plus className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={onHome}
                  className={cn(navIconClass, isHomeActive && "bg-secondary/80 text-foreground")}
                  aria-label="Home"
                >
                  <Home className="h-5 w-5" />
                </button>
                <button type="button" className={navIconClass} aria-label="My Library">
                  <BookOpen className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={onHistory}
                  className={cn(navIconClass, isHistoryActive && "bg-secondary/80 text-foreground")}
                  aria-label="History"
                >
                  <Clock3 className="h-5 w-5" />
                </button>
                <button type="button" className={navIconClass} aria-label="Graph">
                  <GitBranch className="h-5 w-5" />
                </button>

                <div className="mt-auto pb-2">
                  <div className="h-11 w-11 rounded-full bg-primary/15 text-primary inline-flex items-center justify-center">
                    <UserCircle2 className="h-6 w-6" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card/40" />
          </div>
        )}
      </div>
    </aside>
  );
};

export default ResearchSidebar;
