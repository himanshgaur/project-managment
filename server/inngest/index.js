
import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";

// Create Inngest client
export const inngest = new Inngest({
    id: "project-management",
});

// Sync user creation
const syncUserCreation = inngest.createFunction(
    {
        id: "sync-user-creation",
        triggers: [
            {
                event: "clerk/user.created",
            },
        ],
    },
    async ({ event }) => {
        const { data } = event;

        await prisma.user.create({
            data: {
                id: data.id,
                email: data?.email_addresses?.[0]?.email_address,
                name: `${data?.first_name || ""} ${data?.last_name || ""}`.trim(),
                image: data?.image_url,
            },
        });
    }
);

// Sync user deletion
const syncUserDeletion = inngest.createFunction(
    {
        id: "sync-user-deletion",
        triggers: [
            {
                event: "clerk/user.deleted",
            },
        ],
    },
    async ({ event }) => {
        const { data } = event;

        await prisma.user.delete({
            where: {
                id: data.id,
            },
        });
    }
);

// Sync user update
const syncUserUpdation = inngest.createFunction(
    {
        id: "sync-user-updation",
        triggers: [
            {
                event: "clerk/user.updated",
            },
        ],
    },
    async ({ event }) => {
        const { data } = event;

        await prisma.user.update({
            where: {
                id: data.id,
            },
            data: {
                email: data?.email_addresses?.[0]?.email_address,
                name: `${data?.first_name || ""} ${data?.last_name || ""}`.trim(),
                image: data?.image_url,
            },
        });
    }
);

//Ingest function to save workspace data to a database
const syncWorkspaceCreation = inngest.createFunction(
    {
        id: "sync-workspace-creation",
        triggers: [
            {
                event: "clerk/organization.created",
            },
        ],
    },
    async ({ event }) => {
        const { data } = event;

        await prisma.workspace.create({
            data: {
                id: data.id,
                name: data.name,
                slug: data.slug,
                ownerId: data.created_by,
                image_url: data.image_url,
            },
        });

        // Add creator as ADMIN member
        await prisma.workspaceMember.create({
            data: {
                userId: data.created_by,
                workspaceId: data.id,
                role: "ADMIN",
            },
        });
    }
);


// Sync workspace update
const syncWorkspaceUpdation = inngest.createFunction(
    {
        id: "sync-workspace-updation",
        triggers: [
            {
                event: "clerk/organization.updated",
            },
        ],
    },
    async ({ event }) => {
        const { data } = event;

        await prisma.workspace.update({
            where: {
                id: data.id,
            },
            data: {
                name: data.name,
                slug: data.slug,
                image_url: data.image_url,
            },
        });
    }
);


// Sync workspace deletion
const syncWorkspaceDeletion = inngest.createFunction(
    {
        id: "sync-workspace-deletion",
        triggers: [
            {
                event: "clerk/organization.deleted",
            },
        ],
    },
    async ({ event }) => {
        const { data } = event;

        await prisma.workspace.delete({
            where: {
                id: data.id,
            },
        });
    }
);


// Sync workspace member creation
const syncWorkspaceMemberCreation = inngest.createFunction(
    {
        id: "sync-workspace-member-creation",
        triggers: [
            {
                event: "clerk/organization_membership.created",
            },
        ],
    },
    async ({ event }) => {
        const { data } = event;

        await prisma.workspaceMember.create({
            data: {
                userId: data.user_id,
                workspaceId: data.organization_id,
                role: String(data.role_name).toUpperCase(),
            },
        });
    }
);

// Export Inngest functions
export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdation,
    syncWorkspaceCreation,
    syncWorkspaceUpdation,
    syncWorkspaceDeletion,
    syncWorkspaceMemberCreation
];