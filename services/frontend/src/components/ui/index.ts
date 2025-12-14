// Re-export all UI components for convenient imports

// Core shadcn components
export { Button, buttonVariants } from "./button"
export type { ButtonProps } from "./button"
export { Badge, badgeVariants } from "./badge"
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./card"
export { Input } from "./input"
export { Label } from "./label"
export { Textarea } from "./textarea"
export { Separator } from "./separator"
export { Skeleton } from "./skeleton"
export { Switch } from "./switch"
export { Progress } from "./progress"
export { Avatar, AvatarImage, AvatarFallback } from "./avatar"
export { Checkbox } from "./checkbox"

// Dialog and Alert
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./dialog"
export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "./alert-dialog"
export { Alert, AlertTitle, AlertDescription } from "./alert"

// Form components
export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
} from "./form"

// Selection components
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./select"
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "./dropdown-menu"

// Tabs
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs"

// Toast
export { Toaster } from "./toaster"
export { useToast, toast } from "@/hooks/use-toast"

// Custom Vanguard components
export { LoadingButton } from "./loading-button"
export {
  EmptyState,
  EmptyCampaigns,
  EmptyScenes,
  EmptyCharacters,
  EmptyPosts,
  EmptyNotifications,
  EmptySearchResults,
  EmptyMembers,
} from "./empty-state"
export {
  PhaseBadge,
  RoleBadge,
  PassBadge,
  RollBadge,
  NewBadge,
  CountBadge,
} from "./game-badges"
export type { PhaseType, PassState, RollState } from "./game-badges"
