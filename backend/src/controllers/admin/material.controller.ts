import { Request, Response } from 'express';
import { supabaseAdmin } from '../../db/supabaseAdmin';

interface AuthRequest extends Request {
  user?: {
    id: string;
    branchId: string;
    role: string;
  };
}

// Get all study materials
export const getMaterials = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      subjectId,
      batchId,
      type,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const branchId = req.user!.branchId;

    let query = supabaseAdmin
      .from('study_materials')
      .select(`
        id,
        title,
        description,
        type,
        fileUrl,
        fileSize,
        downloadCount,
        isPublic,
        createdAt,
        subject:subjects(id, name),
        batches:material_batches(batch:batches(id, name)),
        uploadedBy:users(id, name)
      `, { count: 'exact' })
      .eq('branchId', branchId);

    // Apply filters
    if (subjectId) query = query.eq('subjectId', subjectId);
    if (type) query = query.eq('type', type);
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply sorting
    query = query.order(sortBy as string, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + Number(limit) - 1);

    const { data: materials, error, count } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Transform batch data
    const transformedMaterials = materials?.map((material: any) => ({
      ...material,
      batches: material.batches?.map((b: any) => b.batch) || []
    }));

    res.json({
      materials: transformedMaterials,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get materials error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get material by ID
export const getMaterialById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    const { data: material, error } = await supabaseAdmin
      .from('study_materials')
      .select(`
        id,
        title,
        description,
        type,
        fileUrl,
        fileName,
        fileSize,
        mimeType,
        downloadCount,
        isPublic,
        metadata,
        createdAt,
        updatedAt,
        subject:subjects(id, name),
        batches:material_batches(batch:batches(id, name)),
        uploadedBy:users(id, name)
      `)
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (error || !material) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }

    res.json({
      ...material,
      batches: material.batches?.map((b: any) => b.batch) || []
    });
  } catch (error) {
    console.error('Get material by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create study material with file upload
export const createMaterial = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = req.user!.branchId;
    const userId = req.user!.id;

    const {
      title,
      description,
      type,
      subjectId,
      batchIds = [],
      isPublic = false,
      metadata = {}
    } = req.body;

    // Handle file upload
    let fileUrl = null;
    let fileName = null;
    let fileSize = null;
    let mimeType = null;

    if (req.file) {
      const file = req.file;
      fileName = file.originalname;
      fileSize = file.size;
      mimeType = file.mimetype;

      // Upload to Supabase Storage
      const fileExt = file.originalname.split('.').pop();
      const fileNameUnique = `${branchId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('study-materials')
        .upload(fileNameUnique, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (uploadError) {
        res.status(400).json({ error: 'File upload failed: ' + uploadError.message });
        return;
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from('study-materials')
        .getPublicUrl(fileNameUnique);

      fileUrl = urlData.publicUrl;
    } else if (type !== 'link') {
      res.status(400).json({ error: 'File is required for this material type' });
      return;
    }

    // For links, fileUrl should be provided in body
    if (type === 'link' && req.body.fileUrl) {
      fileUrl = req.body.fileUrl;
    }

    // Create material record
    const { data: material, error } = await supabaseAdmin
      .from('study_materials')
      .insert({
        branchId,
        title,
        description,
        type,
        subjectId,
        fileUrl,
        fileName,
        fileSize,
        mimeType,
        isPublic,
        metadata,
        uploadedBy: userId
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Assign to batches
    if (batchIds.length > 0) {
      const batchAssignments = batchIds.map((batchId: string) => ({
        materialId: material.id,
        batchId
      }));

      await supabaseAdmin
        .from('material_batches')
        .insert(batchAssignments);
    }

    res.status(201).json({
      message: 'Material created successfully',
      material
    });
  } catch (error) {
    console.error('Create material error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update study material
export const updateMaterial = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    const {
      title,
      description,
      subjectId,
      batchIds,
      isPublic,
      metadata
    } = req.body;

    // Check if material exists and belongs to branch
    const { data: existingMaterial, error: fetchError } = await supabaseAdmin
      .from('study_materials')
      .select('*')
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (fetchError || !existingMaterial) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }

    // Handle new file upload if provided
    let updateData: any = {
      title: title || existingMaterial.title,
      description: description || existingMaterial.description,
      subjectId: subjectId || existingMaterial.subjectId,
      isPublic: isPublic !== undefined ? isPublic : existingMaterial.isPublic,
      metadata: metadata || existingMaterial.metadata,
      updatedAt: new Date().toISOString()
    };

    if (req.file) {
      const file = req.file;
      const fileExt = file.originalname.split('.').pop();
      const fileNameUnique = `${branchId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('study-materials')
        .upload(fileNameUnique, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (!uploadError) {
        const { data: urlData } = supabaseAdmin.storage
          .from('study-materials')
          .getPublicUrl(fileNameUnique);

        // Delete old file if exists
        if (existingMaterial.fileUrl) {
          const oldPath = existingMaterial.fileUrl.split('/study-materials/')[1];
          if (oldPath) {
            await supabaseAdmin.storage.from('study-materials').remove([oldPath]);
          }
        }

        updateData.fileUrl = urlData.publicUrl;
        updateData.fileName = file.originalname;
        updateData.fileSize = file.size;
        updateData.mimeType = file.mimetype;
      }
    }

    // Update material
    const { data: material, error } = await supabaseAdmin
      .from('study_materials')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Update batch assignments if provided
    if (batchIds) {
      // Remove existing assignments
      await supabaseAdmin
        .from('material_batches')
        .delete()
        .eq('materialId', id);

      // Add new assignments
      if (batchIds.length > 0) {
        const batchAssignments = batchIds.map((batchId: string) => ({
          materialId: id,
          batchId
        }));

        await supabaseAdmin
          .from('material_batches')
          .insert(batchAssignments);
      }
    }

    res.json({
      message: 'Material updated successfully',
      material
    });
  } catch (error) {
    console.error('Update material error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete study material
export const deleteMaterial = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.user!.branchId;

    // Get material details
    const { data: material, error: fetchError } = await supabaseAdmin
      .from('study_materials')
      .select('*')
      .eq('id', id)
      .eq('branchId', branchId)
      .single();

    if (fetchError || !material) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }

    // Delete file from storage
    if (material.fileUrl && material.type !== 'link') {
      const filePath = material.fileUrl.split('/study-materials/')[1];
      if (filePath) {
        await supabaseAdmin.storage.from('study-materials').remove([filePath]);
      }
    }

    // Delete batch assignments
    await supabaseAdmin
      .from('material_batches')
      .delete()
      .eq('materialId', id);

    // Delete material record
    const { error } = await supabaseAdmin
      .from('study_materials')
      .delete()
      .eq('id', id);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Record download/increment view count
export const recordDownload = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin.rpc('increment_download_count', { material_id: id });

    if (error) {
      // Fallback if RPC doesn't exist
      const { data: material } = await supabaseAdmin
        .from('study_materials')
        .select('downloadCount')
        .eq('id', id)
        .single();

      await supabaseAdmin
        .from('study_materials')
        .update({ downloadCount: (material?.downloadCount || 0) + 1 })
        .eq('id', id);
    }

    res.json({ message: 'Download recorded' });
  } catch (error) {
    console.error('Record download error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Bulk assign materials to batches
export const bulkAssignToBatches = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { materialIds, batchIds } = req.body;
    const branchId = req.user!.branchId;

    if (!materialIds?.length || !batchIds?.length) {
      res.status(400).json({ error: 'Material IDs and Batch IDs are required' });
      return;
    }

    // Verify all materials belong to branch
    const { data: materials, error: verifyError } = await supabaseAdmin
      .from('study_materials')
      .select('id')
      .in('id', materialIds)
      .eq('branchId', branchId);

    if (verifyError || materials?.length !== materialIds.length) {
      res.status(400).json({ error: 'Some materials not found or access denied' });
      return;
    }

    // Create assignments (ignore duplicates)
    const assignments = materialIds.flatMap((materialId: string) =>
      batchIds.map((batchId: string) => ({
        materialId,
        batchId
      }))
    );

    const { error } = await supabaseAdmin
      .from('material_batches')
      .upsert(assignments, { onConflict: 'ignore' });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      message: 'Materials assigned successfully',
      assignedCount: assignments.length
    });
  } catch (error) {
    console.error('Bulk assign error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get materials by student (for student view)
export const getMaterialsForStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;
    const branchId = req.user!.branchId;

    // Get student's batches
    const { data: studentBatches } = await supabaseAdmin
      .from('student_batches')
      .select('batchId')
      .eq('studentId', studentId);

    const batchIds = studentBatches?.map((sb: any) => sb.batchId) || [];

    if (batchIds.length === 0) {
      res.json({ materials: [] });
      return;
    }

    // Get materials assigned to student's batches
    const { data: materials, error } = await supabaseAdmin
      .from('study_materials')
      .select(`
        id,
        title,
        description,
        type,
        fileUrl,
        fileName,
        fileSize,
        downloadCount,
        createdAt,
        subject:subjects(id, name)
      `)
      .eq('branchId', branchId)
      .or(`isPublic.eq.true,batches.cs.{"batchIds":${JSON.stringify(batchIds)}}`);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ materials });
  } catch (error) {
    console.error('Get materials for student error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};