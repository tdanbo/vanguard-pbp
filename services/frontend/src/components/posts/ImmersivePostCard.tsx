import { useState } from "react";
import { CharacterPortrait } from "@/components/character/CharacterPortrait";
import { PostRollButton } from "@/components/rolls/PostRollButton";
import { PostRollModal } from "@/components/rolls/PostRollModal";
import { WitnessPopover } from "./WitnessPopover";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
    MessageSquare,
    ChevronDown,
    ChevronUp,
    Pencil,
    Lock,
    EyeOff,
    MoreVertical,
    Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import { useCampaignStore } from "@/stores/campaignStore";
import { useToast } from "@/hooks/use-toast";
import type { Post, PostBlock, CampaignSettings, Roll, Character } from "@/types";
import { Card } from "../ui";

interface ImmersivePostCardProps {
    post: Post;
    settings: CampaignSettings;
    roll?: Roll | null;
    isGM?: boolean;
    currentUserId?: string;
    isLastPost?: boolean;
    sceneCharacters?: Character[];
    onEdit?: (post: Post) => void;
    onDelete?: (post: Post) => void;
    onRollUpdated?: () => void;
}

export function ImmersivePostCard({
    post,
    settings,
    roll,
    isGM = false,
    currentUserId,
    isLastPost = false,
    sceneCharacters = [],
    onEdit,
    onDelete,
    onRollUpdated,
}: ImmersivePostCardProps) {
    const { toast } = useToast();
    const { deletePost } = useCampaignStore();
    const [showOOC, setShowOOC] = useState(false);
    const [rollModalOpen, setRollModalOpen] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const hasOOC = Boolean(post.oocText);
    const canSeeOOC = settings.oocVisibility === "all" || isGM;
    const isOwner = post.userId === currentUserId;

    // Determine if user can edit this post
    // GM can always edit any post (locked or not), owner can only edit their unlocked last post
    const canEdit = isGM || (!post.isLocked && isOwner && isLastPost);

    // Determine if user can delete this post
    // GM can always delete any post (locked or not), owner can only delete their unlocked last post
    const canDelete = isGM || (!post.isLocked && isOwner && isLastPost);

    // Show action menu if user can do anything
    const showActionMenu = canEdit || canDelete;

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await deletePost(post.id);
            toast({ title: "Post deleted" });
            onDelete?.(post);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Failed to delete post",
                description: (error as Error).message,
            });
        } finally {
            setIsDeleting(false);
            setShowDeleteDialog(false);
        }
    };

    // Show roll button if post has intention or roll data
    const hasRoll = Boolean(post.intention || roll);

    // Check if this is a narrator post (no character)
    const isNarrator = !post.characterId;

    // For hidden posts that user can't see
    if (post.isHidden && !isGM && !isOwner) {
        return (
            <div className="bg-card rounded-sm border border-dashed border-border/30 p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <EyeOff className="h-4 w-4" />
                    <span className="text-sm italic">Hidden post</span>
                </div>
            </div>
        );
    }

    return (
        <Card className="bg-card/50 rounded-sm overflow-hidden p-1">
            <div
                className={cn(
                    "bg-card rounded-sm overflow-hidden",
                    post.isHidden && "border border-dashed border-border/30",
                )}
            >
                <div className={cn(
                    "h-[160px] md:h-[180px]",
                    isNarrator ? "block" : "grid grid-cols-[80px_1fr] md:grid-cols-[100px_1fr]"
                )}>
                    {/* Portrait column - full height (not shown for narrator) */}
                    {!isNarrator && (
                        <div className="relative h-full">
                            <CharacterPortrait
                                src={post.characterAvatar}
                                name={post.characterName}
                                size="lg"
                                variant="square"
                                className="w-full h-full rounded-none border-0"
                            />
                        </div>
                    )}

                    {/* Content column */}
                    <div className="p-4 relative h-full flex flex-col overflow-hidden">
                        {/* Upper right icons: Witnesses, Roll badge, Edit/Lock, Hidden indicator */}
                        <div className="absolute top-3 right-3 flex items-center gap-2">
                            {/* Witness viewer button (shows EyeOff for hidden posts) */}
                            <WitnessPopover
                                witnessIds={post.witnesses || []}
                                characters={sceneCharacters}
                                isGM={isGM}
                                postId={post.id}
                                isHidden={post.isHidden}
                            />

                            {/* Lock icon for locked posts (only shown to players, not GMs) */}
                            {post.isLocked && !isGM && (
                                <div
                                    className="text-muted-foreground/30"
                                    title="Post is locked (newer posts exist)"
                                >
                                    <Lock className="h-3.5 w-3.5" />
                                </div>
                            )}

                            {/* Action menu (GM can always see; players only on unlocked posts) */}
                            {showActionMenu && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-muted-foreground"
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {canEdit && (
                                            <DropdownMenuItem onClick={() => onEdit?.(post)}>
                                                <Pencil className="mr-2 h-4 w-4" />
                                                Edit
                                            </DropdownMenuItem>
                                        )}
                                        {canDelete && (
                                            <DropdownMenuItem
                                                onClick={() => setShowDeleteDialog(true)}
                                                className="text-destructive focus:text-destructive"
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}

                            {/* Roll button */}
                            {hasRoll && (
                                <PostRollButton
                                    post={post}
                                    roll={roll}
                                    isOwner={isOwner}
                                    isGM={isGM}
                                    onClick={() => setRollModalOpen(true)}
                                />
                            )}
                        </div>

                        {/* Character name */}
                        <h3 className="character-name mb-2 flex-shrink-0">
                            {post.characterName || "Narrator"}
                        </h3>

                        {/* Post content - scrollable with hidden scrollbar */}
                        <div className="relative flex-1 min-h-0">
                            <div className="prose prose-invert prose-sm max-w-none h-full overflow-y-auto scrollbar-hide pr-2">
                                <PostBlocks blocks={post.blocks} />
                            </div>
                            {/* Fade gradient to indicate more content */}
                            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                        </div>

                        {/* Footer: OOC toggle and timestamp */}
                        <div className="flex items-center justify-between pt-2 flex-shrink-0 border-t border-border/20">
                            <div className="flex items-center gap-2">
                                {hasOOC && canSeeOOC && (
                                    <button
                                        onClick={() => setShowOOC(!showOOC)}
                                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <MessageSquare className="h-3 w-3" />
                                        OOC
                                        {showOOC ? (
                                            <ChevronUp className="h-3 w-3" />
                                        ) : (
                                            <ChevronDown className="h-3 w-3" />
                                        )}
                                    </button>
                                )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                                {formatRelativeTime(post.createdAt)}
                            </span>
                        </div>
                    </div>
                </div>
                {/* OOC content (expandable) */}
                {hasOOC && canSeeOOC && showOOC && (
                    <div className={cn(
                        "px-4 pb-4",
                        !isNarrator && "ml-[80px] md:ml-[100px]"
                    )}>
                        <div className="bg-secondary/30 rounded p-3">
                            <p className="text-sm text-muted-foreground">
                                <span className="font-medium">OOC:</span>{" "}
                                {post.oocText}
                            </p>
                        </div>
                    </div>
                )}
                {/* Roll Modal */}
                {hasRoll && (
                    <PostRollModal
                        open={rollModalOpen}
                        onOpenChange={setRollModalOpen}
                        post={post}
                        roll={roll}
                        isOwner={isOwner}
                        isGM={isGM}
                        systemPreset={settings.systemPreset}
                        sceneId={post.sceneId}
                        onRollCompleted={onRollUpdated}
                    />
                )}

                {/* Delete confirmation dialog */}
                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Post</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this post? This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {isDeleting ? "Deleting..." : "Delete"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </Card>
    );
}

interface PostBlocksProps {
    blocks: PostBlock[];
}

function PostBlocks({ blocks }: PostBlocksProps) {
    return (
        <div className="space-y-2">
            {blocks.map((block, index) => (
                <div key={index}>
                    {block.type === "action" ? (
                        <p className="text-foreground">{block.content}</p>
                    ) : (
                        <p className="text-gold italic">"{block.content}"</p>
                    )}
                </div>
            ))}
        </div>
    );
}
