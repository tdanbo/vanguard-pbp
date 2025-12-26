import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Send,
    Lock,
    Unlock,
    Loader2,
    Quote,
    BookOpen,
    EyeOff,
    X,
    Plus,
} from "lucide-react";
import { CharacterPortrait } from "@/components/character/CharacterPortrait";
import { useComposeLock } from "@/hooks/useComposeLock";
import { useDraft } from "@/hooks/useDraft";
import { useCampaignStore } from "@/stores/campaignStore";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
import { APIError } from "@/lib/api";
import { LockTimerBar } from "@/components/realtime";
import { PassButton } from "@/components/phase/PassButton";
import type { Character, CampaignSettings, PostBlock, Post, PassState, CampaignPhase } from "@/types";

interface ImmersiveComposerProps {
    campaignId: string;
    sceneId: string;
    character: Character | null;
    isNarrator?: boolean;
    settings: CampaignSettings;
    onPostCreated?: () => void;
    isLocked?: boolean;
    lockHolder?: string;
    // Edit mode props
    editingPost?: Post | null;
    onEditComplete?: () => void;
    onEditCancel?: () => void;
    // GM indicator
    isGM?: boolean;
    // Phase/pass controls
    currentPhase?: CampaignPhase;
    selectedCharacterPassState?: PassState;
    // Time gate expiration
    isExpired?: boolean;
}

export function ImmersiveComposer({
    campaignId,
    sceneId,
    character,
    isNarrator = false,
    settings,
    onPostCreated,
    isLocked: externalLocked = false,
    lockHolder,
    editingPost,
    onEditComplete,
    onEditCancel,
    isGM = false,
    currentPhase,
    selectedCharacterPassState,
    isExpired = false,
}: ImmersiveComposerProps) {
    const { toast } = useToast();
    const { user } = useAuthStore();
    const { createPost, updatePost } = useCampaignStore();
    const isEditMode = Boolean(editingPost);

    // Determine if GM is editing someone else's character's post (skip compose lock)
    // This is true when: GM + editing mode + character not owned by current user
    const isGMEditingOthersCharacter = isGM && isEditMode && character && character.assigned_user_id !== user?.id;

    const [mode, setMode] = useState<"narrative" | "ooc">("narrative");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [narratorComposing, setNarratorComposing] = useState(false);
    const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());
    const editInitializedRef = useRef<string | null>(null);

    // Derive the effective character ID for hooks (narrator uses 'narrator' as ID)
    const effectiveCharacterId = isNarrator ? "narrator" : character?.id || "";
    const displayName = isNarrator ? "Narrator" : character?.display_name;

    // Compose lock hook (only used for character posts, not narrator)
    const {
        lockId,
        isLocked: hasCharacterLock,
        remainingSeconds,
        acquireLock,
        releaseLock,
        updateHiddenStatus,
        isLoading: lockLoading,
    } = useComposeLock({
        sceneId,
        characterId: isNarrator ? "" : effectiveCharacterId,
        onLockLost: () => {
            toast({
                variant: "destructive",
                title: "Lock expired",
                description: "Your compose lock has expired. Please try again.",
            });
        },
        onError: (error) => {
            // Handle specific error codes
            if (error instanceof APIError) {
                if (error.code === "TIME_GATE_EXPIRED") {
                    toast({
                        variant: "destructive",
                        title: "Time gate expired",
                        description: "The phase has expired. Waiting for GM to transition.",
                    });
                    return;
                }
                if (error.code === "LOCK_HELD") {
                    // Don't show toast for lock held - UI handles this
                    return;
                }
            }
            // Fallback for other errors
            if (!error.message.includes("LOCK_HELD")) {
                toast({
                    variant: "destructive",
                    title: "Failed to acquire lock",
                    description: error.message,
                });
            }
        },
    });

    // For GM editing other's posts, we use narratorComposing flag since we skip the compose lock
    const hasLock = isNarrator ? narratorComposing : (hasCharacterLock || narratorComposing);

    // Draft hook - disable autoLoad when editing to prevent overwriting editingPost content
    const {
        blocks,
        oocText,
        intention,
        isHidden,
        setBlocks,
        setOocText,
        setIntention,
        setIsHidden,
        deleteDraft,
    } = useDraft({
        sceneId,
        characterId: effectiveCharacterId,
        autoLoad: !isEditMode,
    });

    // Check if there's any content in blocks
    const hasBlockContent = blocks.some((b) => b.content.trim());

    // Populate fields and acquire lock when entering edit mode
    // Use ref to prevent re-initialization when unstable setters change
    useEffect(() => {
        if (editingPost && editInitializedRef.current !== editingPost.id) {
            // Mark as initialized for this post
            editInitializedRef.current = editingPost.id;

            setBlocks(editingPost.blocks || []);
            setOocText(editingPost.oocText || "");
            setIntention(editingPost.intention || null);
            setIsHidden(editingPost.isHidden || false);

            // Auto-acquire lock when entering edit mode (only if not already holding a lock)
            // Skip lock acquisition if GM is editing someone else's character's post
            const autoAcquireLock = async () => {
                if (editingPost.characterId && !lockId) {
                    // Check if GM is editing a post from another user's character
                    // In this case, skip compose lock (GM has direct edit permission)
                    if (isGMEditingOthersCharacter) {
                        // GM editing other's post - skip compose lock, just enable edit mode
                        // The backend will validate GM permission on save
                        setNarratorComposing(true); // Use this flag to enable editing UI
                    } else {
                        // Character post owned by user - acquire compose lock
                        try {
                            await acquireLock(editingPost.isHidden || false);
                        } catch {
                            // Error is handled by onError callback in useComposeLock
                        }
                    }
                } else if (!editingPost.characterId && !narratorComposing) {
                    // Narrator post - just set composing state
                    setNarratorComposing(true);
                }
            };
            autoAcquireLock();
        } else if (!editingPost) {
            // Clear initialization tracking when exiting edit mode
            editInitializedRef.current = null;
        }
        // Note: We use editingPost?.id to only re-run when editing a different post
        // Setters are intentionally excluded as they are unstable (change on every render)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingPost?.id, acquireLock, isGMEditingOthersCharacter]);

    // Update hidden status when toggle changes
    useEffect(() => {
        if (lockId) {
            updateHiddenStatus(isHidden);
        }
    }, [isHidden, lockId, updateHiddenStatus]);

    // Add a new block
    const addBlock = useCallback(
        (type: "action" | "dialog") => {
            const newBlock: PostBlock = {
                type,
                content: "",
                order: blocks.length,
            };
            const newBlocks = [...blocks, newBlock];
            setBlocks(newBlocks);
            // Focus the new block after render
            setTimeout(() => {
                const textarea = textareaRefs.current.get(blocks.length);
                textarea?.focus();
            }, 0);
        },
        [blocks, setBlocks],
    );

    // Update a specific block's content
    const updateBlock = useCallback(
        (index: number, content: string) => {
            const newBlocks = blocks.map((block, i) =>
                i === index ? { ...block, content } : block,
            );
            setBlocks(newBlocks);
        },
        [blocks, setBlocks],
    );

    // Delete a block
    const deleteBlock = useCallback(
        (index: number) => {
            const newBlocks = blocks
                .filter((_, i) => i !== index)
                .map((block, i) => ({ ...block, order: i }));
            setBlocks(newBlocks);
        },
        [blocks, setBlocks],
    );

    const handleAcquireLock = async () => {
        if (!character && !isNarrator) return;

        // Clear form fields before acquiring lock (start fresh)
        setBlocks([]);
        setOocText("");
        setIntention(null);
        setIsHidden(false);

        if (isNarrator) {
            setNarratorComposing(true);
        } else {
            await acquireLock(false);
        }
    };

    const handleReleaseLock = async () => {
        if (isNarrator || isGMEditingOthersCharacter) {
            // Narrator posts and GM editing other's posts use narratorComposing flag
            setNarratorComposing(false);
        } else {
            await releaseLock();
        }

        // Always exit edit mode and clear state when releasing
        if (isEditMode) {
            editInitializedRef.current = null;
            onEditCancel?.();
        }

        // Reset form state
        setBlocks([]);
        setOocText("");
        setMode("narrative");
    };

    const handleSubmit = async () => {
        if (!isNarrator && !lockId) {
            toast({
                variant: "destructive",
                title: "No lock",
                description: "You must have an active compose lock to post.",
            });
            return;
        }
        if (!character && !isNarrator) {
            return;
        }

        // Validate content - need at least one block with content
        const filledBlocks = blocks.filter((b) => b.content.trim());
        if (filledBlocks.length === 0 && !oocText.trim()) {
            toast({
                variant: "destructive",
                title: "Empty post",
                description: "Please add at least one action or dialog block.",
            });
            return;
        }

        setIsSubmitting(true);

        try {
            await createPost(campaignId, {
                sceneId,
                characterId: isNarrator ? null : character!.id,
                blocks: filledBlocks,
                oocText: oocText || undefined,
                intention: intention || undefined,
                isHidden,
            });

            await deleteDraft();
            await handleReleaseLock();

            toast({ title: "Post created successfully" });
            onPostCreated?.();

            // Reset to empty state
            setBlocks([]);
            setOocText("");
            setMode("narrative");
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Failed to create post",
                description: (error as Error).message,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingPost) return;

        // Skip lock check for GM editing other's character's posts (they don't acquire a compose lock)
        if (!isNarrator && !lockId && !isGMEditingOthersCharacter) {
            toast({
                variant: "destructive",
                title: "No lock",
                description:
                    "You must have an active compose lock to save changes.",
            });
            return;
        }

        // Validate content
        const filledBlocks = blocks.filter((b) => b.content.trim());
        if (filledBlocks.length === 0 && !oocText.trim()) {
            toast({
                variant: "destructive",
                title: "Empty post",
                description: "Please add at least one action or dialog block.",
            });
            return;
        }

        setIsSubmitting(true);

        try {
            await updatePost(editingPost.id, {
                blocks: filledBlocks,
                oocText: oocText || undefined,
                intention: intention || undefined,
            });

            await handleReleaseLock();

            toast({ title: "Post updated successfully" });
            editInitializedRef.current = null;
            onEditComplete?.();

            // Reset state
            setBlocks([]);
            setOocText("");
            setMode("narrative");
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Failed to update post",
                description: (error as Error).message,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // If no character is selected and not narrator mode, show minimal UI
    if (!character && !isNarrator) {
        return (
            <div className="fixed bottom-0 left-0 right-0 lg:left-1/4 lg:right-1/4 p-4 z-40">
                <div className="w-full">
                    <div className="bg-card rounded-sm px-4 py-3 text-center">
                        <span className="text-sm text-muted-foreground">
                            Select a character to post
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // Check if locked by time gate expiration (players only)
    const isLockedByExpiration = isExpired && !isGM && !isNarrator;

    // Show expired state for players when time gate has expired
    if (isLockedByExpiration && !hasLock) {
        return (
            <div className="fixed bottom-0 left-0 right-0 lg:left-1/4 lg:right-1/4 p-4 z-40">
                <div className="w-full">
                    <div className="bg-card rounded-sm px-4 py-3">
                        <div className="flex items-center justify-center gap-2 text-red-500">
                            <Lock className="h-4 w-4" />
                            <span className="text-sm font-medium">
                                Phase expired. Waiting for GM to transition.
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Show locked by other player state
    if (externalLocked && !hasLock) {
        return (
            <div className="fixed bottom-0 left-0 right-0 lg:left-1/4 lg:right-1/4 p-4 z-40">
                <div className="w-full">
                    <div className="bg-card rounded-sm px-4 py-3">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <Lock className="h-4 w-4" />
                            <span className="text-sm">
                                {lockHolder
                                    ? `${lockHolder} is composing...`
                                    : "Another player is currently posting..."}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 lg:left-1/4 lg:right-1/4 p-4 z-40">
            <div className="w-full">
                <div className={`bg-card rounded-sm overflow-hidden ${hasLock && isHidden ? "ring-2 ring-amber-500/50" : ""}`}>
                    {/* Lock timer bar (not shown for narrator mode) */}
                    {hasLock && !isNarrator && remainingSeconds > 0 && (
                        <LockTimerBar
                            timeRemaining={remainingSeconds}
                            totalTime={600}
                        />
                    )}

                    {!hasLock ? (
                        // Not locked - show acquire button with phase/pass controls
                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {character && (
                                    <CharacterPortrait
                                        src={character.avatar_url}
                                        name={character.display_name}
                                        size="sm"
                                        variant="circle"
                                    />
                                )}
                                {isNarrator && (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-900 to-amber-700 flex items-center justify-center flex-shrink-0">
                                        <BookOpen className="h-4 w-4 text-white/90" />
                                    </div>
                                )}
                                <span className="text-sm text-muted-foreground">
                                    {isEditMode
                                        ? "Editing post"
                                        : `Ready to write as ${displayName}`}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Pass button for players and GMs (non-edit mode, PC phase, has PC character) */}
                                {!isEditMode &&
                                    !isNarrator &&
                                    character &&
                                    character.character_type === 'pc' &&
                                    currentPhase === "pc_phase" && (
                                        <PassButton
                                            campaignId={campaignId}
                                            sceneId={sceneId}
                                            characterId={character.id}
                                            currentState={
                                                selectedCharacterPassState ||
                                                "none"
                                            }
                                            characterName={
                                                character.display_name
                                            }
                                            isOwner={!isGM}
                                            isGM={isGM}
                                            isPCPhase={true}
                                        />
                                    )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAcquireLock}
                                    disabled={lockLoading}
                                >
                                    {lockLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Lock className="h-4 w-4 mr-1" />
                                            {isEditMode
                                                ? "Edit Post"
                                                : "Take Turn"}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        // Has lock - show full composer
                        <>
                            {/* Mode tabs and intent selector */}
                            <div className="px-4 pt-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {/* Character portrait */}
                                    {character && (
                                        <CharacterPortrait
                                            src={character.avatar_url}
                                            name={character.display_name}
                                            size="sm"
                                            variant="circle"
                                        />
                                    )}
                                    {isNarrator && (
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-900 to-amber-700 flex items-center justify-center flex-shrink-0">
                                            <BookOpen className="h-4 w-4 text-white/90" />
                                        </div>
                                    )}
                                    <Tabs
                                        value={mode}
                                        onValueChange={(v) =>
                                            setMode(v as "narrative" | "ooc")
                                        }
                                    >
                                        <TabsList className="bg-secondary/30 h-8">
                                            <TabsTrigger
                                                value="narrative"
                                                className="text-xs h-7"
                                            >
                                                Narrative
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="ooc"
                                                className="text-xs h-7"
                                            >
                                                OOC
                                            </TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </div>

                                {/* Intent dropdown (only in narrative mode) */}
                                {mode === "narrative" &&
                                    settings.systemPreset?.intentions?.length >
                                        0 && (
                                        <Select
                                            value={intention || "none"}
                                            onValueChange={(v) =>
                                                setIntention(
                                                    v === "none" ? null : v,
                                                )
                                            }
                                        >
                                            <SelectTrigger className="h-8 w-[160px] text-xs bg-secondary/50">
                                                <SelectValue placeholder="Intention (optional)" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">
                                                    No roll
                                                </SelectItem>
                                                {settings.systemPreset.intentions.map(
                                                    (int) => (
                                                        <SelectItem
                                                            key={int}
                                                            value={int}
                                                        >
                                                            {int}
                                                        </SelectItem>
                                                    ),
                                                )}
                                            </SelectContent>
                                        </Select>
                                    )}
                            </div>

                            {/* Hidden mode indicator */}
                            {isHidden && (
                                <div className="mx-4 mt-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-500 flex items-center gap-2">
                                    <EyeOff className="h-3 w-3" />
                                    <span>This post will only be visible to the GM until revealed</span>
                                </div>
                            )}

                            {/* Content area */}
                            <div className="p-4 pt-2">
                                {mode === "narrative" ? (
                                    // Narrative mode - show blocks
                                    <div className="space-y-2">
                                        {blocks.length === 0 ? (
                                            // Empty state - prompt to add block
                                            <div className="text-center py-4 text-muted-foreground text-sm">
                                                Add an action or dialog block to
                                                begin
                                            </div>
                                        ) : (
                                            // Render blocks
                                            blocks.map((block, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-start gap-2 group"
                                                >
                                                    {/* Block type icon */}
                                                    <div className="flex-shrink-0 mt-2">
                                                        {block.type ===
                                                        "action" ? (
                                                            <BookOpen className="h-4 w-4 text-amber-500" />
                                                        ) : (
                                                            <Quote className="h-4 w-4 text-blue-400" />
                                                        )}
                                                    </div>
                                                    {/* Block textarea */}
                                                    <Textarea
                                                        ref={(el) => {
                                                            if (el) {
                                                                textareaRefs.current.set(
                                                                    index,
                                                                    el,
                                                                );
                                                            } else {
                                                                textareaRefs.current.delete(
                                                                    index,
                                                                );
                                                            }
                                                        }}
                                                        placeholder={
                                                            block.type ===
                                                            "action"
                                                                ? "Describe what you do..."
                                                                : "Say something..."
                                                        }
                                                        value={block.content}
                                                        onChange={(e) =>
                                                            updateBlock(
                                                                index,
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="flex-1 min-h-[60px] bg-secondary/30 border-border/50 resize-none text-sm"
                                                    />
                                                    {/* Delete button */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="flex-shrink-0 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() =>
                                                            deleteBlock(index)
                                                        }
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                ) : (
                                    // OOC mode - simple textarea
                                    <Textarea
                                        placeholder="Out of character message..."
                                        value={oocText}
                                        onChange={(e) =>
                                            setOocText(e.target.value)
                                        }
                                        className="min-h-[80px] bg-transparent border-0 resize-none focus-visible:ring-0 p-0"
                                    />
                                )}
                            </div>

                            {/* Toolbar */}
                            <div className="px-4 pb-3 flex items-center justify-between">
                                {/* Add block buttons (only in narrative mode) */}
                                <div className="flex gap-1">
                                    {mode === "narrative" && (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8"
                                                onClick={() =>
                                                    addBlock("action")
                                                }
                                            >
                                                <Plus className="h-3 w-3 mr-1" />
                                                <BookOpen className="h-4 w-4 mr-1" />
                                                Description
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8"
                                                onClick={() =>
                                                    addBlock("dialog")
                                                }
                                            >
                                                <Plus className="h-3 w-3 mr-1" />
                                                <Quote className="h-4 w-4 mr-1" />
                                                Dialog
                                            </Button>
                                        </>
                                    )}
                                    {settings.hiddenPosts && (
                                        <Button
                                            variant={
                                                isHidden ? "default" : "ghost"
                                            }
                                            size="sm"
                                            className={`h-8 ${isHidden ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
                                            onClick={() =>
                                                setIsHidden(!isHidden)
                                            }
                                        >
                                            <EyeOff className="h-4 w-4 mr-1" />
                                            {isHidden ? "Hidden" : "Hide"}
                                        </Button>
                                    )}
                                </div>

                                {/* Release and Submit/Save */}
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleReleaseLock}
                                    >
                                        <Unlock className="h-4 w-4 mr-1" />
                                        Release
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={
                                            isEditMode
                                                ? handleUpdate
                                                : handleSubmit
                                        }
                                        disabled={
                                            (mode === "narrative" &&
                                                !hasBlockContent) ||
                                            (mode === "ooc" &&
                                                !oocText.trim()) ||
                                            isSubmitting
                                        }
                                        className={isHidden && !isEditMode ? "bg-amber-600 hover:bg-amber-700" : ""}
                                    >
                                        {isSubmitting ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <>
                                                {isHidden && !isEditMode ? (
                                                    <EyeOff className="h-4 w-4 mr-1" />
                                                ) : (
                                                    <Send className="h-4 w-4 mr-1" />
                                                )}
                                                {isEditMode
                                                    ? "Save Changes"
                                                    : isHidden
                                                        ? "Post Hidden"
                                                        : "Post"}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
