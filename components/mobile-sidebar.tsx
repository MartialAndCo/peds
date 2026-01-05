import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { usePathname } from "next/navigation";
import { SidebarAdmin } from "@/components/sidebar-admin";
import { SidebarWorkspace } from "@/components/sidebar-workspace";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export const MobileSidebar = () => {
    const [isMounted, setIsMounted] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return null;
    }

    const isWorkspace = pathname.startsWith('/workspace');

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 border-r-0 w-72">
                <SheetTitle className="sr-only">Mobile Menu</SheetTitle>
                {isWorkspace ? <SidebarWorkspace /> : <SidebarAdmin />}
            </SheetContent>
        </Sheet>
    );
};
