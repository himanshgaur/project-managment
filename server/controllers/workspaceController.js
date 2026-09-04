import prisma from "../configs/prisma.js";


//Get all workspaces
export const getUserWorkspaces = async (req, res) => {
  try {
    const {userId} =  await req.auth();
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