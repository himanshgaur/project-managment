import prisma from "../configs/prisma.js";
import { clerkClient } from "@clerk/express";


//Get all workspaces
export const getUserWorkspaces = async (req, res) => {
  try {
        const { userId, orgId, orgRole } = await req.auth();

        // The membership webhook may be delayed or unavailable during local
        // development. Reconcile the active Clerk organization on first request
        // so invited users do not remain on the loading screen forever.
        if (userId && orgId) {
            const clerkUser = await clerkClient.users.getUser(userId);
            const email = clerkUser.emailAddresses[0]?.emailAddress || `${userId}@clerk.local`;
            const name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User";

            await prisma.user.upsert({
                where: { id: userId },
                update: { email, name, image: clerkUser.imageUrl || "" },
                create: { id: userId, email, name, image: clerkUser.imageUrl || "" },
            });

            // The Clerk organization webhook may not reach a local Inngest
            // server. Reconcile it here so a newly created organization can
            // immediately open the dashboard.
            const organization = await clerkClient.organizations.getOrganization({
                organizationId: orgId,
            });

            await prisma.workspace.upsert({
                where: { id: orgId },
                update: {
                    name: organization.name,
                    slug: organization.slug || organization.id,
                    image_url: organization.imageUrl || "",
                },
                create: {
                    id: organization.id,
                    name: organization.name,
                    slug: organization.slug || organization.id,
                    ownerId: organization.createdBy,
                    image_url: organization.imageUrl || "",
                },
            });

            await prisma.workspaceMember.upsert({
                where: {
                    userId_workspaceId: { userId, workspaceId: orgId },
                },
                update: {},
                create: {
                    userId,
                    workspaceId: orgId,
                    role: orgRole === "org:admin" ? "ADMIN" : "MEMBER",
                },
            });
        }

    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId: userId,
          }
        }
      },
        include: {
            members: {include: {user: true}},
            projects:{
                include: {
                    tasks: {include: {assignee: true, comments: {include: {user: true}}}},
                    members: {include: {user: true}}
                }
            },
            owner: true

            }
    });

    const userIds = new Set();
    workspaces.forEach((workspace) => {
        workspace.members.forEach((member) => userIds.add(member.userId));
        workspace.projects.forEach((project) => {
            project.members.forEach((member) => userIds.add(member.userId));
            project.tasks.forEach((task) => userIds.add(task.assigneeId));
        });
        userIds.add(workspace.ownerId);
    });

    const clerkUsers = new Map(await Promise.all(
        [...userIds].map(async (id) => {
            try {
                const clerkUser = await clerkClient.users.getUser(id);
                const email = clerkUser.emailAddresses[0]?.emailAddress || "";
                const name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim();
                return [id, { email, name: name || email, image: clerkUser.imageUrl || "" }];
            } catch {
                return [id, null];
            }
        })
    ));

    workspaces.forEach((workspace) => {
        const updateUser = (user) => {
            const clerkUser = clerkUsers.get(user.id);
            if (clerkUser) Object.assign(user, clerkUser);
        };

        updateUser(workspace.owner);
        workspace.members.forEach((member) => updateUser(member.user));
        workspace.projects.forEach((project) => {
            project.members.forEach((member) => updateUser(member.user));
            project.tasks.forEach((task) => updateUser(task.assignee));
        });
    });

    res.json({workspaces});
  } catch (error) {
    console.error(error);
    res.status(500).json({error: "Internal server error"});

  }
}


//Add member to workspace
export const addMember = async (req, res) => {
    try{
        const {userId} = await req.auth();
        const {email, role, workspaceId, message} = req.body;

        //Check  if user exists
        const user = await prisma.user.findUnique({
            where: {
                email: email
            }
        });

        if (!user) {
            return res.status(404).json({error: "User not found"});
        }

        if(!workspaceId || !role){
            return res.status(400).json({error: "Missing required fields"});
        }

        if(!["ADMIN", "MEMBER"].includes(role)){
            return res.status(400).json({error: "Invalid role"});
        }

        //fetch workspace
        const workspace = await prisma.workspace.findUnique({
            where: {
                id: workspaceId
            },
            include: {
                members: true
            }
        });

        if (!workspace) {
            return res.status(404).json({error: "Workspace not found"});
        }

        //check creator has admin role
        if(!workspace.members.find((member)=> member.userId === userId && member.role === "ADMIN")){
            return res.status(401).json({error: "You are not authorized to add members to this workspace"});
        }

        //Check if user is already a member
        const existingMember = workspace.members.find((member) => member.userId === user.id);
        if (existingMember) {
            return res.status(400).json({error: "User is already a member of this workspace"});
        }

        const member = await prisma.workspaceMember.create({
            data: {
                userId: user.id,
                workspaceId: workspaceId,
                role: role,
                message: message || null
            }
        });

        res.json({message: "Member added successfully", member});

    } catch (error) {
        console.error(error);
        res.status(500).json({error: "Internal server error"});
    }
}