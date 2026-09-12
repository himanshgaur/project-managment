
import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";
import sendEmail from "../configs/nodemailer.js";
import { assign } from "nodemailer/lib/shared/index.js";

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

        const role = data.role_name === "org:admin" ? "ADMIN" : "MEMBER";

        await prisma.workspaceMember.upsert({
            where: {
                userId_workspaceId: {
                    userId: data.user_id,
                    workspaceId: data.organization_id,
                },
            },
            update: {
                role,
            },
            create: {
                userId: data.user_id,
                workspaceId: data.organization_id,
                role,
            },
        });
    }
);

//Inngest function to send email on task creation 
const sendTaskAssignmentEmail = inngest.createFunction(
    // { id: "send-task-assignment-mail" },
    // { event: "app/task.assigned" },
    {
        id: "send-task-assignment-mail",
        triggers: {
            event: "app/task.assigned",
        },
    },
    async ({ event, step }) => {
        const { taskId, origin } = event.data;

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { assignee: true, project: true }
        })

        await sendEmail({
            to: task.assignee.email,
            subject: `New Task Assignment in ${task.project.name}`,
            body: ` <div style="
        max-width: 600px;
        margin: 40px auto;
        background-color: #ffffff;
        border-radius: 10px;
        padding: 30px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    ">

        <h2 style="color: #333;">
            Hi ${task.assignee.name},
        </h2>

        <p style="font-size: 16px; color: #555;">
            You have been assigned a new task.
        </p>

        <div style="
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        ">

            <p style="margin: 0 0 10px;">
                <strong>Task:</strong> ${task.title}
            </p>

            <p style="margin: 0;">
                <strong>Due Date:</strong> 
                ${new Date(task.due_date).toLocaleDateString()}
            </p>

        </div>

        <a href="${origin}"
           style="
                display: inline-block;
                padding: 12px 24px;
                background-color: #007bff;
                color: #ffffff;
                text-decoration: none;
                border-radius: 6px;
                font-size: 15px;
           ">
            View Task
        </a>

        <p style="
            margin-top: 30px;
            font-size: 13px;
            color: #888;
        ">
            Please review the task and complete it before the due date.
        </p>

    </div>
`
        })
        if(new Date(task.due_date).toLocaleDateString() !== new Date().toLocaleDateString()){
            await step.sleepUntil('wait-for-the-due-date', new Date(task.due_date));
            await step.run('check-if-task-is-completed', async () => {
                const task = await prisma.task.findUnique({
                    where: {id: taskId},
                    include: {assignee: true, project: true}
                })

                if(!task) return;

                if(task.status !== "DONE"){
                    await step.run('send-task-reminder-email',async () => {
                        await sendEmail({
                            to: task.assignee.email,
                            subject: `Remider for ${task.project.name}`, 
                            body: `<div style="
        max-width: 600px;
        margin: 40px auto;
        background-color: #ffffff;
        border-radius: 10px;
        padding: 30px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    ">

        <h2 style="color: #333;">
            Hi ${task.assignee.name},
        </h2>

        <p style="font-size: 16px; color: #555;">
            You have been assigned a new task.
        </p>

        <div style="
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        ">

            <p style="margin: 0 0 10px;">
                <strong>Task:</strong> ${task.title}
            </p>

            <p style="margin: 0;">
                <strong>Due Date:</strong> 
                ${new Date(task.due_date).toLocaleDateString()}
            </p>

        </div>

        <a href="${origin}"
           style="
                display: inline-block;
                padding: 12px 24px;
                background-color: #007bff;
                color: #ffffff;
                text-decoration: none;
                border-radius: 6px;
                font-size: 15px;
           ">
            View Task
        </a>

        <p style="
            margin-top: 30px;
            font-size: 13px;
            color: #888;
        ">
            Please review the task and complete it before the due date.
        </p>

    </div>`
                        })
                    })
                }
            })
        }
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
    syncWorkspaceMemberCreation,
    sendTaskAssignmentEmail
];