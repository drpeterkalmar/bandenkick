# Rocketbox (FBX aus 3ds Max, MIT) → GLB, headless in Blender 5.2:
#   Blender -b --factory-startup --python tools/rb_to_glb.py -- avatar Sports_Male_02 [...]
#   Blender -b --factory-startup --python tools/rb_to_glb.py -- anims m Sports_Male_02
# avatar: Mesh + Skelett (T-Pose, ohne Animation), saubere Materialien (Farbe + Normalmap, Rauheit fest),
#         Ergebnis assets_src/work/avatars/<Name>.glb (Texturen noch groß; tools/pack_avatars.mjs verkleinert).
# anims:  Rocketbox-Clips (selbes Biped-Skelett „Bip01“, aber eigene Ruhepose = erster Frame) werden per
#         Weltrotation Knochen für Knochen auf das Skelett des Referenz-Avatars übertragen und direkt als
#         F-Curves gebacken (schnell, ohne Constraints). Wurzelbewegung: Laufzyklen verlieren nur die mittlere
#         Vorwärtsfahrt (Tempo → clips.json, damit die Füße zum Spieltempo passen), alle anderen die ganze
#         waagrechte Verschiebung; Drehungen um die Hochachse (Turn-Clips) werden herausgerechnet (die
#         Blickrichtung kommt aus der Simulation). Gesichtsknochen bleiben in Ruhe.
import bpy, json, math, os, sys
from mathutils import Matrix, Quaternion, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets_src', 'rocketbox', 'Assets')
WORK = os.path.join(ROOT, 'assets_src', 'work')
KINDS = {'Sports': 'Professions'}

FACE = {'REye', 'LEye', 'MJaw', 'MBottomLip', 'MTongue', 'LMouthBottom', 'RMouthBottom', 'RMasseter', 'LMasseter',
        'MUpperLip', 'RCaninus', 'LCaninus', 'REyeBlinkBottom', 'LEyeBlinkBottom', 'RUpperlip', 'LUpperlip',
        'RMouthCorner', 'LMouthCorner', 'RCheek', 'LCheek', 'REyeBlinkTop', 'LEyeBlinkTop', 'RInnerEyebrow',
        'LInnerEyebrow', 'MMiddleEyebrow', 'ROuterEyebrow', 'LOuterEyebrow', 'MNose'}
# Clips: Name im Spiel → (Rocketbox-Datei ohne m_/f_, Ordner, Art). Art: cycle = Laufzyklus (Vorwärtsfahrt
# herausrechnen, Tempo messen), inplace = ganze waagrechte Verschiebung weg, turn = zusätzlich Drehung weg.
CLIPS = {
    'idle': ('idle_breathe_01', 'static', 'inplace'),
    'walk': ('walk_neutral_01', 'xy', 'cycle'),
    'jog': ('run_slow_01', 'xy', 'cycle'),
    'run': ('run_neutral_01', 'xy', 'cycle'),
    'sprint': ('run_fast_01', 'xy', 'cycle'),
    'start': ('run_start', 'xy', 'inplace'),
    'stop': ('run_stop', 'xy', 'inplace'),
    'turnL90': ('turn_left_90', 'xyz', 'turn'),
    'turnR90': ('turn_right_90', 'xyz', 'turn'),
    'turnL180': ('turn_left_180', 'xyz', 'turn'),
    'cheer': ('cheer_01', 'static', 'inplace'),
    'cheer2': ('cheer_03', 'static', 'inplace'),
    'clap': ('claphands_01', 'static', 'inplace'),
    'wait': ('idle_waiting_01', 'static', 'inplace'),
    'crouch': ('crouch_idle', 'static', 'inplace'),
    'wave': ('wave_01', 'static', 'inplace'),
}
FOLDER = {'static': 'all_animations_max_motextr_static', 'xy': 'all_animations_max_motextr_xy', 'xyz': 'all_animations_max_motextr_xyz'}
MAX_S = {'wait': 6.0, 'cheer': 5.0, 'clap': 4.0, 'crouch': 3.0}  # lange Clips kürzen (Dateigröße), sonst ≤ 8 s


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def avatar_path(name):
    kind = 'Professions' if name.startswith('Sports_') else 'Adults'
    return os.path.join(SRC, 'Avatars', kind, name)


def import_avatar(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(avatar_path(name), 'Export', name + '.fbx'))
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == 'ARMATURE')
    mesh = next(o for o in new if o.type == 'MESH')
    for o in new:
        if o.type == 'EMPTY':
            bpy.data.objects.remove(o)
    return arm, mesh


def fix_materials(name, mesh):
    tex = os.path.join(avatar_path(name), 'Textures')
    for m in mesh.data.materials:
        nt = m.node_tree
        imgs = {}
        for n in nt.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                fn = os.path.basename(n.image.filepath.replace('\\', '/'))
                imgs['opacity' if 'opacity' in fn else 'color' if '_color' in fn else 'normal' if '_normal' in fn else 'spec'] = fn
        nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
        bsdf.inputs['Roughness'].default_value = 0.72
        bsdf.inputs['Metallic'].default_value = 0.0
        nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
        if 'color' in imgs:
            t = nt.nodes.new('ShaderNodeTexImage')
            t.image = bpy.data.images.load(os.path.join(tex, imgs['color']))
            nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
        if 'opacity' in imgs:  # Haare/Wimpern: Farbe + Alpha aus einer RGBA-Textur
            t = nt.nodes.new('ShaderNodeTexImage')
            t.image = bpy.data.images.load(os.path.join(tex, imgs['opacity']))
            nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
            nt.links.new(t.outputs['Alpha'], bsdf.inputs['Alpha'])
        if 'normal' in imgs:
            t = nt.nodes.new('ShaderNodeTexImage')
            t.image = bpy.data.images.load(os.path.join(tex, imgs['normal']))
            t.image.colorspace_settings.name = 'Non-Color'
            nm = nt.nodes.new('ShaderNodeNormalMap')
            nt.links.new(t.outputs['Color'], nm.inputs['Color'])
            nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
        if hasattr(m, 'blend_method'):
            m.blend_method = 'CLIP' if 'opacity' in imgs else 'OPAQUE'
        if hasattr(m, 'surface_render_method'):
            m.surface_render_method = 'DITHERED'


def export_glb(path, objects, animations):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
              export_texcoords=True, export_normals=True, export_tangents=False, export_materials='EXPORT',
              export_image_format='AUTO', export_jpeg_quality=92, export_skins=True, export_def_bones=False,
              export_animations=animations, export_morph=False, export_extras=True)
    if animations:
        kw.update(export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_step=1,
                  export_optimize_animation_size=False, export_anim_single_armature=True, export_reset_pose_bones=True,
                  export_bake_animation=False, export_anim_slide_to_zero=True, export_negative_frame='SLIDE')
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    bpy.ops.export_scene.gltf(**{k: v for k, v in kw.items() if k in props})


def cmd_avatar(names):
    for name in names:
        reset()
        arm, mesh = import_avatar(name)
        fix_materials(name, mesh)
        mesh.data.name = mesh.name = name
        # Maße für die Prüfung: Höhe, Beckenhöhe, Fußsohle
        mw = mesh.matrix_world
        zs = [(mw @ v.co).z for v in mesh.data.vertices]
        info = {'name': name, 'height': max(zs) - min(zs), 'minZ': min(zs), 'pelvis': (arm.matrix_world @ arm.data.bones['Bip01 Pelvis'].head_local).z,
                'bones': len(arm.data.bones), 'verts': len(mesh.data.vertices), 'tris': sum(len(p.vertices) - 2 for p in mesh.data.polygons)}
        print('AVATAR', json.dumps(info))
        export_glb(os.path.join(WORK, 'avatars', name + '.glb'), [arm, mesh], False)
        json.dump(info, open(os.path.join(WORK, 'avatars', name + '.json'), 'w'))


def facing_yaw(arm):
    mw = arm.matrix_world
    l, r = mw @ arm.pose.bones['Bip01 L Thigh'].head, mw @ arm.pose.bones['Bip01 R Thigh'].head
    right = r - l
    fwd = Vector((0, 0, 1)).cross(Vector((right.x, right.y, 0)).normalized())
    return math.atan2(fwd.y, fwd.x)


def cmd_anims(sex, ref):
    reset()
    A, mesh = import_avatar(ref)
    bpy.data.objects.remove(mesh)
    scene = bpy.context.scene
    scene.render.fps = 30
    A_mw = A.matrix_world.copy()
    A_inv = A_mw.inverted()
    A_rot_inv = A_mw.to_quaternion().inverted()
    bones = [b for b in A.data.bones if b.name.replace('Bip01 ', '') not in FACE]
    order = []
    def walk(b):
        if b.name.replace('Bip01 ', '') not in FACE:
            order.append(b)
        for c in b.children:
            walk(c)
    for b in A.data.bones:
        if b.parent is None:
            walk(b)
    rest = {b.name: b.matrix_local.copy() for b in A.data.bones}
    rest_yaw = facing_yaw(A)
    meta = {}
    A.animation_data_create()
    for clip, (fname, folder, kind) in CLIPS.items():
        path = os.path.join(SRC, 'Animations', FOLDER[folder], f'{sex}_{fname}.max.fbx')
        if not os.path.exists(path):
            print('FEHLT', path); continue
        before = set(bpy.data.objects)
        acts_before = set(bpy.data.actions)
        bpy.ops.import_scene.fbx(filepath=path)
        new = [o for o in bpy.data.objects if o not in before]
        B = next(o for o in new if o.type == 'ARMATURE')
        imported_acts = [a for a in bpy.data.actions if a not in acts_before]
        src_act = B.animation_data.action
        f0, f1 = int(round(src_act.frame_range[0])), int(round(src_act.frame_range[1]))
        f1 = min(f1, f0 + int(MAX_S.get(clip, 8.0) * 30))
        frames = list(range(f0, f1 + 1))
        # 1) Weltmatrizen der Quellknochen je Frame + Becken/Blickrichtung
        samples = []
        for f in frames:
            scene.frame_set(f)
            Bmw = B.matrix_world.copy()
            samples.append({pb.name: Bmw @ pb.matrix for pb in B.pose.bones if pb.name in rest})
        pel = [s['Bip01 Pelvis'].translation.copy() for s in samples]
        n = len(frames)
        # Blickrichtung je Frame aus den Oberschenkel-Köpfen (Seitenachse)
        def yaw_of(s):
            r = s['Bip01 R Thigh'].translation - s['Bip01 L Thigh'].translation
            fwd = Vector((0, 0, 1)).cross(Vector((r.x, r.y, 0)).normalized())
            return math.atan2(fwd.y, fwd.x)
        yaws = [yaw_of(s) for s in samples]
        speed = 0.0
        corr = []  # je Frame: (Drehung um z, Verschiebung) auf die Quellposen
        if kind == 'cycle':
            d = pel[-1] - pel[0]
            dur = (n - 1) / 30
            speed = math.hypot(d.x, d.y) / dur
            # mittlere Blickrichtung → auf die Ruhe-Blickrichtung drehen (Zyklus kann leicht schräg laufen)
            travel_yaw = math.atan2(d.y, d.x)
            dyaw = rest_yaw - travel_yaw
            for i in range(n):
                shift = Vector((pel[0].x + d.x * i / (n - 1), pel[0].y + d.y * i / (n - 1), 0))
                corr.append((dyaw, shift))
        else:
            for i in range(n):
                dyaw = rest_yaw - (yaws[i] if kind == 'turn' else yaws[0])
                corr.append((dyaw, Vector((pel[i].x, pel[i].y, 0))))
        # 2) Zielposen auf dem Referenz-Skelett, Knochen für Knochen (Eltern zuerst)
        curves = {}  # (bone, 'rot'|'loc') → Liste je Frame
        for i, s in enumerate(samples):
            dyaw, shift = corr[i]
            Rz = Quaternion((0, 0, 1), dyaw)
            M_arm = {}
            for b in order:
                name = b.name
                Mw = s[name]
                q_world = Rz @ Mw.to_quaternion()
                R_arm = (A_rot_inv @ q_world).to_matrix().to_4x4()
                if b.parent is None:
                    loc_w = Mw.translation - shift
                    loc_w = Rz @ loc_w
                    loc_w += Vector((A_mw.translation.x, A_mw.translation.y, 0))
                    parent_part = rest[name]
                    M_t = Matrix.Translation(A_inv @ loc_w) @ R_arm
                else:
                    parent_part = M_arm[b.parent.name] @ rest[b.parent.name].inverted() @ rest[name]
                    M_t = Matrix.Translation(parent_part.translation) @ R_arm
                basis = parent_part.inverted() @ M_t
                M_arm[name] = M_t
                q = basis.to_quaternion()
                prev = curves.get((name, 'rot'))
                if prev and prev[-1].dot(q) < 0:
                    q.negate()  # Vorzeichen stetig halten
                curves.setdefault((name, 'rot'), []).append(q)
                if b.parent is None:
                    curves.setdefault((name, 'loc'), []).append(basis.translation.copy())
        # 3) Als Aktion mit F-Curves schreiben (Blender 5: Ebenen/Slots)
        act = bpy.data.actions.new(clip)
        act.use_fake_user = True
        slot = act.slots.new(id_type='OBJECT', name=A.name)
        layer = act.layers.new('Layer')
        strip = layer.strips.new(type='KEYFRAME')
        cb = strip.channelbag(slot, ensure=True)
        for (name, what), vals in curves.items():
            dp = f'pose.bones["{name}"].' + ('rotation_quaternion' if what == 'rot' else 'location')
            comps = 4 if what == 'rot' else 3
            for c in range(comps):
                fc = cb.fcurves.new(dp, index=c, group_name=name)
                fc.keyframe_points.add(n)
                co = []
                for k in range(n):
                    co += [float(k + 1), float(vals[k][c])]
                fc.keyframe_points.foreach_set('co', co)
                for kp in fc.keyframe_points:
                    kp.interpolation = 'LINEAR'
                fc.update()
        meta[clip] = {'src': f'{sex}_{fname}', 'frames': n, 'duration': (n - 1) / 30, 'kind': kind, 'speed': round(speed, 3),
                      'pelvis': round(sum(p.z for p in pel) / n, 3)}
        print('CLIP', clip, json.dumps(meta[clip]))
        for o in new:
            bpy.data.objects.remove(o, do_unlink=True)
        for a in imported_acts:
            bpy.data.actions.remove(a)  # Quell-Aktionen des Imports (würden sonst mit exportiert)
    for pb in A.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    # Aktionen als NLA-Spuren anhängen (Export „ACTIONS“ findet sie so sicher)
    ad = A.animation_data
    for clip in meta:
        act = bpy.data.actions[clip]
        tr = ad.nla_tracks.new(); tr.name = clip
        st = tr.strips.new(clip, 1, act)
        st.action_slot = act.slots[0] if hasattr(st, 'action_slot') else None
        tr.mute = True
    ad.action = None
    out = os.path.join(WORK, f'anims_{sex}.glb')
    export_glb(out, [A], True)
    meta['_ref'] = {'avatar': ref, 'pelvis': (A_mw @ A.data.bones['Bip01 Pelvis'].head_local).z}
    json.dump(meta, open(os.path.join(WORK, f'anims_{sex}.json'), 'w'), indent=1)
    print('OK', out)


argv = sys.argv[sys.argv.index('--') + 1:]
if argv[0] == 'avatar':
    cmd_avatar(argv[1:])
elif argv[0] == 'anims':
    cmd_anims(argv[1], argv[2])
