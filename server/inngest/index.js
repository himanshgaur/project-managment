
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
    {id: 'sync-workspace-from-clerk'},
    {event: 'clerk/workspace.created'},
    async ({ event }) => {
        const {data} = event;
        await prisma.workspace.create({
            data:{
                id: data.id,
                name: data.name,
                slug: data.slug,
                ownerId: data.created_by,
                image_url: data.image_url,
            }
        });

        //Add creator as ADMIN member
        await prisma.workspaceMember.create({
            data:{
                userId: data.created_by,
                workspaceId: data.id,
                role: "ADMIN"
            }
        })
    }
);


//Inngest function to update workspace data to a database
const syncWorkspaceUpdation = inngest.createFunction(
    {id: 'sync-workspace-from-clerk'},
    {event: 'clerk/organization.updated'},
    async ({ event }) => {
        const {data} = event;
        await prisma.workspace.update({
            where:{
                id: data.id
            },
            data:{
                name: data.name,
                slug: data.slug,
                image_url: data.image_url,
            }
        })
    }
)

//Inngest function to delete workspace data from a database
const syncWorkspaceDeletion = inngest.createFunction(
    {id: 'sync-workspace-from-clerk'},
    {event: 'clerk/organization.deleted'},
    async ({ event }) => {
        const {data} = event;
        await prisma.workspace.delete({
            where:{
                id: data.id
            }
        })
    }
)

//Inngest function to add workspace member data to a database
const syncWorkspaceMemberCreation = inngest.createFunction(
    {id: 'sync-workspace-member-from-clerk'},
    {event: 'clerk/organizationInvitation.accepted'},
    async ({ event }) => {
        const {data} = event;
        await prisma.workspaceMember.create({
            data:{
                userId: data.user_id,
                workspaceId: data.organization_id,
                role: String(data.role_name).toUpperCase()
            }
        })
    }
)

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