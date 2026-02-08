import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth0 } from "@auth0/auth0-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { apiRequest, ApiError } from "@/lib/api";

type GroupMember = {
    _id: string;
    firstName?: string;
    lastName?: string;
    university?: string;
    course?: string;
    year?: number;
};

type GroupSummary = {
    _id: string;
    name: string;
    interest?: string | null;
    module?: {
        name?: string;
        course?: string;
        university?: string;
    } | null;
    startAt?: string;
    endAt?: string;
};

type GroupMembersResponse = {
    data: {
        group: GroupSummary;
        members: GroupMember[];
    };
};

type ChatMessage = {
    id: string;
    text: string;
    createdAt: string;
    senderId: string | null;
    senderName: string;
};

type ChatEvent =
    | { type: "history"; messages: ChatMessage[] }
    | { type: "message"; message: ChatMessage }
    | { type: "members"; members: GroupMember[] }
    | { type: "group-closed" };

type MeResponse = {
    data: {
        _id?: string;
    };
};

type GroupMembersViewProps = {
    groupId?: string;
};

const getMemberName = (member: GroupMember) => {
    const first = typeof member.firstName === "string" ? member.firstName.trim() : "";
    const last = typeof member.lastName === "string" ? member.lastName.trim() : "";
    const name = [first, last].filter((value) => value.length > 0).join(" ");
    return name || "Member";
};

export default function GroupMembersView({ groupId }: GroupMembersViewProps) {
    const params = useParams();
    const resolvedGroupId = groupId ?? params.groupId;
    const { getAccessTokenSilently, isAuthenticated } = useAuth0();
    const navigate = useNavigate();
    const [group, setGroup] = useState<GroupSummary | null>(null);
    const [members, setMembers] = useState<GroupMember[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLeaving, setIsLeaving] = useState(false);
    const [leaveError, setLeaveError] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [chatError, setChatError] = useState<string | null>(null);
    const [isChatConnecting, setIsChatConnecting] = useState(false);
    const chatSocketRef = useRef<WebSocket | null>(null);
    const chatScrollRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isAuthenticated) return;
        let isActive = true;

        const loadMe = async () => {
            try {
                const response = await apiRequest<MeResponse>(
                    "/me",
                    { method: "GET" },
                    () =>
                        getAccessTokenSilently({
                            authorizationParams: {
                                audience: import.meta.env.VITE_AUTH0_AUDIENCE
                            }
                        })
                );
                if (!isActive) return;
                setCurrentUserId(response?.data?._id ?? null);
            } catch {
                if (!isActive) return;
                setCurrentUserId(null);
            }
        };

        void loadMe();

        return () => {
            isActive = false;
        };
    }, [getAccessTokenSilently, isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated || !resolvedGroupId) return;
        let isActive = true;

        const loadMembers = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await apiRequest<GroupMembersResponse>(
                    `/groups/${resolvedGroupId}/members`,
                    { method: "GET" },
                    () =>
                        getAccessTokenSilently({
                            authorizationParams: {
                                audience: import.meta.env.VITE_AUTH0_AUDIENCE
                            }
                        })
                );

                if (!isActive) return;
                setGroup(response.data.group);
                setMembers(response.data.members ?? []);
            } catch (err) {
                if (!isActive) return;
                if (err instanceof ApiError && err.status === 403) {
                    setError("You need to join this group to view members.");
                } else if (err instanceof ApiError) {
                    setError(`Unable to load members. (${err.status})`);
                } else {
                    setError("Unable to load members.");
                }
            } finally {
                if (isActive) setIsLoading(false);
            }
        };

        void loadMembers();

        return () => {
            isActive = false;
        };
    }, [getAccessTokenSilently, isAuthenticated, resolvedGroupId]);

    useEffect(() => {
        if (!isAuthenticated || !resolvedGroupId) return;
        let isActive = true;

        const connectChat = async () => {
            setIsChatConnecting(true);
            setChatError(null);
            try {
                const token = await getAccessTokenSilently({
                    authorizationParams: {
                        audience: import.meta.env.VITE_AUTH0_AUDIENCE
                    }
                });

                const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";
                const wsUrl = new URL(apiBase);
                wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
                wsUrl.pathname = "/ws";
                wsUrl.searchParams.set("token", token);
                wsUrl.searchParams.set("groupId", resolvedGroupId);

                const socket = new WebSocket(wsUrl.toString());
                chatSocketRef.current = socket;

                socket.onopen = () => {
                    if (!isActive) return;
                    setIsChatConnecting(false);
                };

                socket.onmessage = (event) => {
                    if (!isActive) return;
                    try {
                        const payload = JSON.parse(event.data) as ChatEvent;
                        if (payload.type === "history") {
                            setChatMessages(payload.messages ?? []);
                        } else if (payload.type === "message") {
                            setChatMessages((prev) => [...prev, payload.message]);
                        } else if (payload.type === "members") {
                            setMembers(payload.members ?? []);
                        } else if (payload.type === "group-closed") {
                            setError("This group is no longer available.");
                        }
                    } catch {
                        return;
                    }
                };

                socket.onerror = () => {
                    if (!isActive) return;
                    setChatError("Chat connection failed.");
                };

                socket.onclose = () => {
                    if (!isActive) return;
                    setChatError("Chat disconnected.");
                };
            } catch {
                if (!isActive) return;
                setIsChatConnecting(false);
                setChatError("Unable to connect to chat.");
            }
        };

        void connectChat();

        return () => {
            isActive = false;
            chatSocketRef.current?.close();
            chatSocketRef.current = null;
        };
    }, [getAccessTokenSilently, isAuthenticated, resolvedGroupId]);

    useEffect(() => {
        if (!chatScrollRef.current) return;
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }, [chatMessages]);

    const handleChatSend = () => {
        const socket = chatSocketRef.current;
        const text = chatInput.trim();
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            setChatError("Chat is not connected.");
            return;
        }
        if (!text) return;
        socket.send(JSON.stringify({ type: "message", text }));
        setChatInput("");
    };

    const handleLeaveGroup = async () => {
        if (!resolvedGroupId) return;
        setIsLeaving(true);
        setLeaveError(null);
        try {
            await apiRequest<{ data: GroupSummary }>(
                `/groups/${resolvedGroupId}/leave`,
                { method: "POST" },
                () =>
                    getAccessTokenSilently({
                        authorizationParams: {
                            audience: import.meta.env.VITE_AUTH0_AUDIENCE
                        }
                    })
            );
            navigate("/");
        } catch (err) {
            if (err instanceof ApiError && err.status === 409) {
                setLeaveError("You are not in this group.");
            } else if (err instanceof ApiError) {
                setLeaveError(`Unable to leave group. (${err.status})`);
            } else {
                setLeaveError("Unable to leave group.");
            }
        } finally {
            setIsLeaving(false);
        }
    };

    const groupSubtitle = useMemo(() => {
        if (!group) return "";
        return group.module?.name ?? group.interest ?? "Study group";
    }, [group]);

    const groupDetails = useMemo(() => {
        if (!group) return null;
        if (group.module) {
            const lines = [group.module.name, group.module.course, group.module.university]
                .filter((value) => typeof value === "string" && value.trim().length > 0);
            return {
                title: "Module",
                description: lines.join(" · ") || "Module details unavailable"
            };
        }

        if (group.interest) {
            return {
                title: "Interest",
                description: group.interest
            };
        }

        return {
            title: "Group focus",
            description: "Details unavailable"
        };
    }, [group]);

    return (
        <div className="relative min-h-screen bg-background px-5 pb-24 pt-16 text-foreground">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
                <header className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <h1 className="text-2xl font-semibold">Group members</h1>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleLeaveGroup}
                            disabled={isLeaving}
                        >
                            {isLeaving ? "Leaving..." : "Leave group"}
                        </Button>
                    </div>
                    {group && (
                        <p className="text-sm text-muted-foreground">
                            {group.name} · {groupSubtitle}
                        </p>
                    )}
                    {leaveError && (
                        <p className="text-xs text-destructive">{leaveError}</p>
                    )}
                </header>

                {isLoading ? (
                    <div className="flex h-[40vh] items-center justify-center">
                        <Spinner className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : error ? (
                    <p className="text-sm text-destructive">{error}</p>
                ) : (
                    <>
                        <Card>
                            <CardHeader>
                                <CardTitle>Members</CardTitle>
                                <CardDescription>
                                    {members.length} member{members.length === 1 ? "" : "s"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {members.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        No members found yet.
                                    </p>
                                ) : (
                                    <ul className="space-y-3">
                                        {members.map((member) => (
                                            <li
                                                key={member._id}
                                                className="rounded-lg border border-border bg-background px-4 py-3"
                                            >
                                                <p className="text-sm font-medium">
                                                    {member._id === currentUserId ? "You" : getMemberName(member)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {[member.university, member.course, member.year ? `Year ${member.year}` : null]
                                                        .filter(Boolean)
                                                        .join(" · ") || "Profile details not set"}
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>

                        {groupDetails && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>{groupDetails.title}</CardTitle>
                                    <CardDescription>{groupDetails.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground">
                                        {group?.module
                                            ? "This group is focused on the selected module."
                                            : "This group is focused on a shared interest."}
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader>
                                <CardTitle>Group chat</CardTitle>
                                <CardDescription>
                                    {isChatConnecting ? "Connecting..." : "Chat with your group"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {chatError && (
                                    <p className="text-xs text-destructive">{chatError}</p>
                                )}
                                <div
                                    ref={chatScrollRef}
                                    className="max-h-[320px] space-y-3 overflow-y-auto rounded-lg border border-border bg-background/60 p-4"
                                >
                                    {chatMessages.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No messages yet.</p>
                                    ) : (
                                        chatMessages.map((message) => (
                                            <div key={message.id} className="space-y-1">
                                                <p className="text-xs text-muted-foreground">
                                                    {message.senderId === currentUserId ? "You" : message.senderName}
                                                </p>
                                                <p className="text-sm">{message.text}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <form
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        handleChatSend();
                                    }}
                                    className="flex flex-wrap gap-2"
                                >
                                    <Input
                                        value={chatInput}
                                        onChange={(event) => setChatInput(event.target.value)}
                                        placeholder="Send a message"
                                        className="flex-1"
                                        disabled={isChatConnecting}
                                    />
                                    <Button type="submit" disabled={isChatConnecting || !chatInput.trim()}>
                                        Send
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
}
