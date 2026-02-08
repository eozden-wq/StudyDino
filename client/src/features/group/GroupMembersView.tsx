import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth0 } from "@auth0/auth0-react";

import BackButton from "@/components/routing/BackButton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

type MeResponse = {
    data: {
        _id?: string;
    };
};

type GroupMembersViewProps = {
    groupId?: string;
};

const getMemberName = (member: GroupMember) => {
    const name = [member.firstName, member.lastName].filter(Boolean).join(" ");
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
                )}
            </div>
        </div>
    );
}
