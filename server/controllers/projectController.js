import prisma from "../configs/prisma.js";

//create project
export const createProject = async (req, res) => {
    try {
        const {userId} = await req.auth();
        const {workspaceId, name, description, status, start_date, end_date, team_members, team_lead, progress, priority} = req.body;  

        //check if user has admin role for workspace
        const workspace = await prisma.workspace.findUnique({
            where: {
                id: workspaceId
            },
            include:{members: {include: {user: true}}}
        });

        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        if(!workspace.members.some(member => member.userId === userId && member.role === 'ADMIN')) {
            return res.status(403).json({ message: "You are not authorized to create a project in this workspace" });
        }

        //get team lead using email
        const teamLead = await prisma.user.findUnique({
            where: {
                email: team_lead
            },
            select: {
                id: true
            }
        });

        const isWorkspaceMember = workspace.members.some(
            (member) => member.userId === teamLead?.id
        );

        if (!teamLead || !isWorkspaceMember) {
            return res.status(400).json({
                message: "The selected project lead is not a workspace member",
            });
        }

        const project = await prisma.project.create({   
            data: {
                workspaceId,
                name,
                description,
                status,
                priority,
                progress,
                team_lead: teamLead?.id,
                start_date: start_date ? new Date(start_date) : null,
                end_date: end_date ? new Date(end_date) : null,

            }
        });

        //add team members to porject if they are in workspace
        if(team_members?.length > 0) {
            const memberstoAdd = []
            workspace.members.forEach(member => {
                if(team_members.includes(member.user.email)) {
                    memberstoAdd.push(member.user.id);
                }
            });
            await prisma.projectMember.createMany({
                data: memberstoAdd.map(memberId => ({
                    projectId: project.id,
                    userId: memberId
                }))
            });
        }

        const projectWithMembers = await prisma.project.findUnique({
            where: {
                id: project.id
            },
            include: {
                members: {
                    include: {
                        user: true
                    }
                },
                tasks: {
                    include: {
                        assignee: true,
                        comments: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
                owner: true,
            }
        });

        res.status(201).json({ message: "Project created successfully", project: projectWithMembers });

    }catch (error) {
        console.log(error);
        res.status(500).json({ message: error.code || error.message });
    }
}

//update project
export const updateProject = async (req, res) => {
    try {

        const {userId} = await req.auth();
        const {id,workspaceId,  name, description, status, start_date, end_date, team_members, team_lead, progress, priority} = req.body;

        //check if user has admin role for workspace
        const workspace = await prisma.workspace.findUnique({
            where: {
                id: workspaceId
            },
            include:{members: {include: {user: true}}}
        });

        if(!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        if(!workspace.members.some(member => member.userId === userId && member.role === 'ADMIN')) {
            const project = await prisma.project.findUnique({
                where: {
                    id: id
                }
            });
            if(!project) {
                return res.status(404).json({ message: "Project not found" });
            }else if(project.team_lead !== userId) {
                return res.status(403).json({ message: "You are not the team lead of this project" });
            }
        }

        const existingProject = await prisma.project.findUnique({
            where: { id },
            select: { workspaceId: true },
        });
        if (!existingProject) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (existingProject.workspaceId !== workspaceId) {
            return res.status(403).json({ message: "Project does not belong to this workspace" });
        }

        const project = await prisma.project.update({
            where: {
                id: id
            },
            data: {
                workspaceId,
                description,
                name,
                status,
                team_lead,
                progress,
                priority,
                start_date: start_date ? new Date(start_date) : null,
                end_date: end_date ? new Date(end_date) : null,
            }
        });

        res.json({ message: "Project updated successfully", project });

    }catch (error) {
        console.log(error);
        res.status(500).json({ message: error.code || error.message });
    }
}


//Add member to project
export const addMember = async (req, res) => {
    try {
        const {userId} = await req.auth();
        const {projectId} = req.params;
        const {email} = req.body;

        //check if user is project lead
        const project = await prisma.project.findUnique({
            where: {
                id: projectId
            },
            include: {
                members: {
                    include: {
                        user: true,
                    },
                },
                workspace: {
                    include: {
                        members: true,
                    }
                }
            }
        });
        if(!project){
            return res.status(404).json({message: "project not found"});
        }

        const isWorkspaceAdmin = project.workspace.members.some(
            (member) => member.userId === userId && member.role === "ADMIN"
        );

        if (project.team_lead !== userId && !isWorkspaceAdmin) {
            return res.status(403).json({
                message: "Only the project lead or workspace admin can add members",
            });
        }

        //check if user is already a member
        const existingMember = project.members.find(
            (member) => member.user.email === email
        );
        if(existingMember){
            return res.status(400).json({message: " user is already a member"});
        }

        const user = await prisma.user.findUnique({where: {email}});
        if(!user){
            return res.status(404).json({message: "user not found"});
        }

        const isWorkspaceMember = project.workspace.members.some(
            (member) => member.userId === user.id
        );

        if (!isWorkspaceMember) {
            return res.status(400).json({
                message: "User must belong to the workspace before being added to the project",
            });
        }

        const member = await prisma.projectMember.create({
            data:{
                userId: user.id,
                projectId
            }
        })

        res.json({member, message:"member added successfully"});

    }catch (error) {
        console.log(error);
        res.status(500).json({ message: error.code || error.message });
    }
}