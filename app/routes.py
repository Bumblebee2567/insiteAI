from app.main import ask_gemini, transcribe_audio
from app.models import Message, User
from flask import render_template, request, jsonify, url_for, flash, redirect, current_app
from flask_bcrypt import Bcrypt
from app.forms import RegisterForm, LoginForm
from app import app
from app import db
import os
import tempfile
from werkzeug.utils import secure_filename


bcrypt = Bcrypt()
from flask_login import (
    login_user,
    logout_user,
    login_required,
    current_user
)

@app.route("/")
@app.route("/home")
def home():
    return render_template("home.html")

@app.route("/transcribe", methods=["POST"])
def transcribe():
    try:
        # Make sure an audio file was actually sent
        if "audio" not in request.files:
            return jsonify({
                "success": False,
                "error": "No audio file received."
            }), 400

        audio_file = request.files["audio"]

        if not audio_file or audio_file.filename == "":
            return jsonify({
                "success": False,
                "error": "No recording received."
            }), 400

        # Create a temporary file
        with tempfile.NamedTemporaryFile(
            suffix=".webm",
            delete=False
        ) as temp_file:

            temp_path = temp_file.name
            audio_file.save(temp_path)

        try:
            # Send the audio to Gemini
            text = transcribe_audio(temp_path)

            return jsonify({
                "success": True,
                "text": text
            })

        finally:
            # Delete temporary audio file
            if os.path.exists(temp_path):
                os.remove(temp_path)

    except Exception as e:
        print("TRANSCRIPTION ERROR:", e)

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500
      
@app.route("/chat")
@login_required
def chat():

    messages = (
        Message.query
        .filter_by(user_id=current_user.id)
        .order_by(Message.created_at.asc())
        .all()
    )

    return render_template(
        "insite.html",
        messages=messages
    )

@app.route("/send_message", methods=["POST"])
@login_required
def send_message():

    prompt = request.form.get("message", "").strip()
    file = request.files.get("file")

    image_path = None
    full_path = None
    file_path = None
    file_type = None
    file_name = None

    # ==========================================
    # HANDLE FILE
    # ==========================================

    if file:
        upload_folder = os.path.join(
            app.root_path,
            "static",
            "uploads"
        )

        os.makedirs(upload_folder, exist_ok=True)

        filename = secure_filename(file.filename)

        full_path = os.path.join(upload_folder, filename)
        file.save(full_path)

        file_path = os.path.join(
            "uploads",
            filename
        ).replace("\\", "/")

        file_type = file.mimetype
        file_name = filename

        if file_type and file_type.startswith("image/"):
            image_path = file_path


    # ==========================================
    # SAVE USER MESSAGE
    # ==========================================

    user_message = Message(
        user_id=current_user.id,
        role="user",
        content=prompt,
        image_path=image_path,
        file_path=file_path,
        file_name=file_name,
        file_type=file_type
    )

    db.session.add(user_message)
    db.session.commit()


    # ==========================================
    # GET RECENT CONVERSATION
    # ==========================================

    messages = (
        Message.query
        .filter_by(user_id=current_user.id)
        .order_by(Message.created_at.desc())
        .limit(60)
        .all()
    )

    messages.reverse()


    conversation = [
        {
            "role": msg.role,
            "content": msg.content or ""
        }
        for msg in messages
    ]


    # ==========================================
    # SEND TO GEMINI
    # ==========================================

    try:

        answer = ask_gemini(
            conversation,
            file_path=full_path,
            mime_type=file_type
        )

    except Exception as e:

        import traceback

        print("========== GEMINI ERROR ==========")
        print(str(e))
        traceback.print_exc()
        print("===================================")

        return jsonify({
            "error": str(e)
        }), 500


    # ==========================================
    # SAVE AI RESPONSE
    # ==========================================

    assistant_message = Message(
        user_id=current_user.id,
        role="assistant",
        content=answer
    )

    db.session.add(assistant_message)
    db.session.commit()


    # ==========================================
    # RESPONSE TO JAVASCRIPT
    # ==========================================

    return jsonify({
        "answer": answer,
        "file": {
            "name": file_name,
            "type": file_type,
            "url": (
                url_for(
                    "static",
                    filename=file_path
                )
                if file_path
                else None
            )
        }
    })

@app.route('/admin-dashboard', methods=['GET'])
@login_required
def admin_dashboard():
    # Security check: Only allow your specific admin account
    if not current_user.is_admin:
        flash('❌ Access denied. Administrator privileges required.', 'danger')
        return redirect(url_for('home'))

    total_users = User.query.count()
    users = User.query.all()
    
    return render_template('admin.html', 
                           total_users=total_users, 
                           users=users)

@app.route('/admin/delete-user/<int:user_id>', methods=['POST'])
@login_required
def admin_delete_user(user_id):
    if user_id == current_user.id:
        flash('❌ You cannot delete your own admin account!', 'danger')
        return redirect(url_for('admin_dashboard'))
        
    admin_password = request.form.get('admin_password')
    
    # 🛠️ FIX: If your model uses 'password_hash' instead of 'password' for the stored hash, change it here:
    # (Or if you have a method like current_user.check_password(admin_password), use that instead!)
    try:
        is_valid = bcrypt.check_password_hash(current_user.password_hash, admin_password)
    except AttributeError:
        # Fallback if your model stores the hash under a different attribute name
        is_valid = bcrypt.check_password_hash(current_user._password, admin_password)

    if not admin_password or not is_valid:
        flash('❌ Incorrect admin password! User deletion aborted.', 'danger')
        return redirect(url_for('admin_dashboard'))
        
    user_to_delete = User.query.get_or_404(user_id)
    try:
        # Delete user's chat logs first
        Message.query.filter_by(user_id=user_id).delete()
        
        # Delete user account against their will
        db.session.delete(user_to_delete)
        db.session.commit()
        flash(f'✅ User "{user_to_delete.username}" has been permanently deleted.', 'success')
    except Exception as e:
        db.session.rollback()
        flash('❌ An error occurred while deleting the user.', 'danger')
        
    return redirect(url_for('admin_dashboard'))

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile_page():
    if request.method == 'POST':
        # Handle updating username
        new_username = request.form.get('username')
        if new_username:
            current_user.username = new_username
            db.session.commit()
            flash('Profile name updated successfully!', 'success')
            return redirect(url_for('profile_page'))
    return render_template('profile.html')

@app.route('/clear-history', methods=['POST'])
@login_required
def clear_chat_history():
    # Assuming your chat model is named Message and linked to current_user.id
    Message.query.filter_by(user_id=current_user.id).delete()
    db.session.commit()
    flash('Chat history deleted successfully.', 'info')
    return redirect(url_for('profile_page'))

@app.route('/update-profile', methods=['POST'])
@login_required
def update_profile():
    new_username = request.form.get('username')
    if new_username:
        try:
            current_user.username = new_username
            db.session.commit()
            flash('Profile name updated successfully!', 'success')
        except Exception as e:
            db.session.rollback()
            flash('An error occurred while updating your profile.', 'danger')
            
    return redirect(url_for('profile_page'))

@app.route('/settings', methods=['GET'])
@login_required
def settings_page():
    return render_template('settings.html')

@app.route('/update-ai-preferences', methods=['POST'])
@login_required
def update_ai_preferences():
    custom_prompt = request.form.get('custom_prompt')
    try:
        current_user.custom_prompt = custom_prompt
        db.session.commit()
        flash('AI instructions updated successfully!', 'success')
    except Exception as e:
        db.session.rollback()
        flash('An error occurred while saving AI preferences.', 'danger')
    return redirect(url_for('settings_page'))

@app.route('/update-app-preferences', methods=['POST'])
@login_required
def update_app_preferences():
    try:
        current_user.stream_ai = True if request.form.get('stream_ai') == 'on' else False
        current_user.code_highlight = True if request.form.get('code_highlight') == 'on' else False
        current_user.email_reminders = True if request.form.get('email_reminders') == 'on' else False
        
        db.session.commit()
        flash('Application preferences updated successfully!', 'success')
    except Exception as e:
        db.session.rollback()
        flash('An error occurred while saving preferences.', 'danger')
    return redirect(url_for('settings_page'))

@app.route('/delete-account', methods=['POST'])
@login_required
def delete_account():
    user_id = current_user.id
    try:
        # Delete user's chat messages first
        Message.query.filter_by(user_id=user_id).delete()
        
        # Delete user record from database
        user = User.query.get(user_id)
        db.session.delete(user)
        db.session.commit()
        
        logout_user()
        flash('Your account has been permanently deleted.', 'info')
        return redirect(url_for('home'))
    except Exception as e:
        db.session.rollback()
        flash('An error occurred while deleting your account.', 'danger')
        return redirect(url_for('settings_page'))

@app.route('/chat', methods=['POST'])
@login_required
def chat_endpoint():
    user_message = request.form.get('message') # or request.json.get('message')
    
    # 1. Grab the user's custom prompt if they wrote one
    user_custom_instructions = current_user.custom_prompt if current_user.custom_prompt else ""
    
    # 2. Combine your original AI system prompt with their custom instructions
    # (Notice how your original master system instructions come first so they override it)
    system_instruction = "You are Insite AI, a helpful academic assistant."
    
    if user_custom_instructions:
        system_instruction += f"\n\nUser Custom Instructions (Follow these if they do not violate safety guidelines): {user_custom_instructions}"
        
    # 3. Send both 'system_instruction' and the 'user_message' to your AI API (OpenAI, Gemini, etc.)
    # ai_response = call_ai_api(system_instruction, user_message)
    
    return jsonify({'response': ai_response})


@app.route("/study")
@login_required
def study_page():
    return render_template("study.html")

@app.route("/more")
@login_required
def more_page():
    return render_template("more.html")

@app.route("/study/mathematics")
@login_required
def math_page():
    return render_template("subjects/mathematics.html")

@app.route("/study/mathematics/Numbers_and_fraction")
@login_required
def num_and_frac_page():
    return render_template("subjects/math/num_and_frac.html")

@app.route("/study/mathematics/algebra")
@login_required
def algebra():
    return render_template("subjects/math/algebra.html")

@app.route("/study/mathematics/graph_functions")
@login_required
def graph_():
    return render_template("subjects/math/graph_functions.html")

@app.route("/study/mathematics/geometry")
@login_required
def geometry():
    return render_template("subjects/math/geometry.html")

@app.route("/study/mathematics/menstruation")
@login_required
def menstruation():
    return render_template("subjects/math/menstruation.html")

@app.route("/study/mathematics/trigonometry")
@login_required
def trigonometry():
    return render_template("subjects/math/trigonometry.html")

@app.route("/study/mathematics/coordinate_geometry")
@login_required
def c_geometry():
    return render_template("subjects/math/c_geo.html")

@app.route("/study/mathematics/statistics")
@login_required
def statistics():
    return render_template("subjects/math/statistics.html")

@app.route("/study/mathematics/probability")
@login_required
def probability():
    return render_template("subjects/math/probability.html")

@app.route("/study/mathematics/indices_and_logarithms")
@login_required
def indices():
    return render_template("subjects/math/indices.html")

@app.route("/study/mathematics/sequence")
@login_required
def sequence():
    return render_template("subjects/math/sequence.html")

@app.route("/study/mathematics/calculus")
@login_required
def calculus():
    return render_template("subjects/math/calculus.html")

# Chemistry 

@app.route("/study/chemistry")
@login_required
def chemistry_page():
    return render_template("subjects/chemistry.html")

@app.route("/study/chemistry/atomic_structure")
@login_required
def atomic():
    return render_template("subjects/chemistry/atomic.html")

@app.route("/study/chemistry/periodic_table")
@login_required
def periodic():
    return render_template("subjects/chemistry/periodic.html")

@app.route("/study/chemistry/chemical_bonding")
@login_required
def bonding():
    return render_template("subjects/chemistry/bonding.html")

@app.route("/study/chemistry/chemical_formulae")
@login_required
def formulae():
    return render_template("subjects/chemistry/formulae.html")

@app.route("/study/chemistry/mole_concepts")
@login_required
def mole():
    return render_template("subjects/chemistry/mole.html")

@app.route("/study/chemistry/stoichiometry")
@login_required
def stoichiometry():
    return render_template("subjects/chemistry/stoichiometry.html")

@app.route("/study/chemistry/state_of_matter")
@login_required
def matter():
    return render_template("subjects/chemistry/matter.html")

@app.route("/study/chemistry/gas_laws")
@login_required
def gas():
    return render_template("subjects/chemistry/gas.html")

@app.route("/study/chemistry/solutions")
@login_required
def solutions():
    return render_template("subjects/chemistry/solutions.html")

@app.route("/study/chemistry/acids,bases_and_salts")
@login_required
def abs():
    return render_template("subjects/chemistry/abs.html")

@app.route("/study/chemistry/ph_and_indicators")
@login_required
def ph():
    return render_template("subjects/chemistry/ph.html")

@app.route("/study/chemistry/electrochemistry")
@login_required
def electro():
    return render_template("subjects/chemistry/electro.html")

@app.route("/study/chemistry/redox_reactions")
@login_required
def redox():
    return render_template("subjects/chemistry/redox.html")

@app.route("/study/chemistry/energy_changes")
@login_required
def energy():
    return render_template("subjects/chemistry/energy.html")

@app.route("/study/chemistry/reaction_rates")
@login_required
def rr():
    return render_template("subjects/chemistry/rr.html")

@app.route("/study/chemistry/chemical_equilibrium")
@login_required
def equal():
    return render_template("subjects/chemistry/equal.html")

@app.route("/study/chemistry/organic_chemistry")
@login_required
def organic():
    return render_template("subjects/chemistry/organic.html")

@app.route("/study/chemistry/hydrocarbons")
@login_required
def hc():
    return render_template("subjects/chemistry/hc.html")

@app.route("/study/chemistry/functional_groups")
@login_required
def fc():
    return render_template("subjects/chemistry/fc.html")

@app.route("/study/chemistry/polymers")
@login_required
def polymers():
    return render_template("subjects/chemistry/polymers.html")

@app.route("/study/chemistry/metals")
@login_required
def metals():
    return render_template("subjects/chemistry/metals.html")

@app.route("/study/chemistry/environmental_chemistry")
@login_required
def ec():
    return render_template("subjects/chemistry/ec.html")

# Chemistry Practical s
@app.route("/study/chemistry/chemistry_practicals")
@login_required
def cp():
    return render_template("subjects/chemistry/chemistry_p/cp.html")

@app.route("/study/chemistry/chemistry_practicals/acid,bases_and_salt")
@login_required
def c_abs():
    return render_template("subjects/chemistry/chemistry_p/abs.html")

@app.route("/study/chemistry/chemistry_practicals/indicators_and_pH")
@login_required
def p_h():
    return render_template("subjects/chemistry/chemistry_p/p_h.html")

@app.route("/study/chemistry/chemistry_practicals/preparation_of_salts")
@login_required
def salts():
    return render_template("subjects/chemistry/chemistry_p/salts.html")

@app.route("/study/chemistry/chemistry_practicals/standard_solutions")
@login_required
def standard_solutions():
    return render_template("subjects/chemistry/chemistry_p/standard_solutions.html")

@app.route("/study/chemistry/chemistry_practicals/titration_methodology")
@login_required
def titration_methodology():
    return render_template("subjects/chemistry/chemistry_p/titration_methodology.html")

@app.route("/study/chemistry/chemistry_practicals/concentration_calculations")
@login_required
def concentration_calculations():
    return render_template("subjects/chemistry/chemistry_p/concentration_calculations.html")

@app.route("/study/chemistry/chemistry_practicals/tests_for_cations")
@login_required
def tests_for_cations():
    return render_template("subjects/chemistry/chemistry_p/tests_for_cations.html")

@app.route("/study/chemistry/chemistry_practicals/flame_emmision_tests")
@login_required
def flame():
    return render_template("subjects/chemistry/chemistry_p/flame.html")

@app.route("/study/chemistry/chemistry_practicals/test_for_cation")
@login_required
def cation():
    return render_template("subjects/chemistry/chemistry_p/cation.html")

@app.route("/study/chemistry/chemistry_practicals/gas_evolution_tests")
@login_required
def gas_s():
    return render_template("subjects/chemistry/chemistry_p/gas.html")

@app.route("/study/chemistry/chemistry_practicals/filteration_and_weeding")
@login_required
def filter():
    return render_template("subjects/chemistry/chemistry_p/filter.html")

@app.route("/study/chemistry/chemistry_practicals/distillation")
@login_required
def distil():
    return render_template("subjects/chemistry/chemistry_p/distil.html")

@app.route("/study/chemistry/chemistry_practicals/cinematography_rf")
@login_required
def rf():
    return render_template("subjects/chemistry/chemistry_p/rf.html")

@app.route("/study/chemistry/chemistry_practicals/org1")
@login_required
def org1():
    return render_template("subjects/chemistry/chemistry_p/org1.html")

@app.route("/study/chemistry/chemistry_practicals/combustion_profiles")
@login_required
def combust():
    return render_template("subjects/chemistry/chemistry_p/combust.html")

@app.route("/study/chemistry/chemistry_practicals/functional_groups")
@login_required
def fg():
    return render_template("subjects/chemistry/chemistry_p/fg.html")

@app.route("/study/chemistry/chemistry_practicals/electrochemical_cells")
@login_required
def ecells():
    return render_template("subjects/chemistry/chemistry_p/ecells.html")

@app.route("/study/chemistry/chemistry_practicals/redox_titrations")
@login_required
def redoxt():
    return render_template("subjects/chemistry/chemistry_p/redoxt.html")

@app.route("/study/chemistry/chemistry_practicals/measurement_and_tolerance")
@login_required
def mt():
    return render_template("subjects/chemistry/chemistry_p/mt.html")

@app.route("/study/chemistry/chemistry_practicals/apparatus_catalog")
@login_required
def apcat():
    return render_template("subjects/chemistry/chemistry_p/apcat.html")

@app.route("/study/chemistry/chemistry_practicals/safety_and_chemical_hazards")
@login_required
def hazard():
    return render_template("subjects/chemistry/chemistry_p/hazard.html")

@app.route("/study/chemistry/chemistry_problem_solving")
@login_required
def calc():
    return render_template("subjects/chemistry/calc.html")

#======================================================
#     Physics
#======================================================

@app.route("/study/physics")
@login_required
def physics_page():
    return render_template("subjects/physics.html")

@app.route("/study/physics/kinematics")
@login_required
def kinematics():
    return render_template("subjects/physics/kinematics.html")

@app.route("/study/physics/newton_laws")
@login_required
def newton_laws():
    return render_template("subjects/physics/newton_laws.html")

@app.route("/study/physics/work_energy")
@login_required
def work_energy():
    return render_template("subjects/physics/work_energy.html")

@app.route("/study/physics/momentum_collisions")
@login_required
def momentum_collisions():
    return render_template("subjects/physics/momentum_collisions.html")

@app.route("/study/physics/rotational_motion")
@login_required
def rotational_motion():
    return render_template("subjects/physics/rotational_motion.html")

@app.route("/study/physics/gravitation")
@login_required
def gravitation():
    return render_template("subjects/physics/gravitation.html")

@app.route("/study/physics/properties_matter")
@login_required
def properties_matter():
    return render_template("subjects/physics/properties_matter.html")

@app.route("/study/physics/thermal_physics")
@login_required
def thermal_physics():
    return render_template("subjects/physics/thermal_physics.html")

@app.route("/study/physics/kinetic_theory_gases")
@login_required
def kinetic_theory_gases():
    return render_template("subjects/physics/kinetic_theory_gases.html")

@app.route("/study/physics/thermodynamics_laws")
@login_required
def thermodynamics_laws():
    return render_template("subjects/physics/thermodynamics_laws.html")

@app.route("/study/physics/shm")
@login_required
def shm():
    return render_template("subjects/physics/shm.html")

@app.route("/study/physics/wave_motion")
@login_required
def wave_motion():
    return render_template("subjects/physics/wave_motion.html")

@app.route("/study/physics/optics_geometric")
@login_required
def optics_geometric():
    return render_template("subjects/physics/optics_geometric.html")

@app.route("/study/physics/optics_physical")
@login_required
def optics_physical():
    return render_template("subjects/physics/optics_physical.html")

@app.route("/study/physics/electrostatics")
@login_required
def electrostatics():
    return render_template("subjects/physics/electrostatics.html")

@app.route("/study/physics/current_electricity")
@login_required
def current_electricity():
    return render_template("subjects/physics/current_electricity.html")

@app.route("/study/physics/magnetism")
@login_required
def magnetism():
    return render_template("subjects/physics/magnetism.html")

@app.route("/study/physics/electromagnetic_induction")
@login_required
def electromagnetic_induction():
    return render_template("subjects/physics/electromagnetic_induction.html")

@app.route("/study/physics/em_waves")
@login_required
def em_waves():
    return render_template("subjects/physics/em_waves.html")

@app.route("/study/physics/quantum_physics")
@login_required
def quantum_physics():
    return render_template("subjects/physics/quantum_physics.html")

@app.route("/study/physics/atomic_structure_physics")
@login_required
def atomic_structure_physics():
    return render_template("subjects/physics/atomic_structure_physics.html")

@app.route("/study/physics/nuclear_physics")
@login_required
def nuclear_physics():
    return render_template("subjects/physics/nuclear_physics.html")

@app.route("/study/physics/semiconductors")
@login_required
def semiconductors():
    return render_template("subjects/physics/semiconductors.html")

@app.route("/study/physics/physics_problem_solving")
@login_required
def physics_problem_solving():
    return render_template("subjects/physics/physics_problem_solving.html")

#==========================================
#  Biology
#==========================================

@app.route("/study/biology")
@login_required
def biology_page():
    return render_template("subjects/biology.html")

@app.route("/study/biology/cell_biology_energetics")
@login_required
def cell_biology_energetics():
    return render_template("subjects/biology/cell_biology_energetics.html")

@app.route("/study/biology/molecular_genetics_heredity")
@login_required
def molecular_genetics_heredity():
    return render_template("subjects/biology/molecular_genetics_heredity.html")

@app.route("/study/biology/evolution_diversity")
@login_required
def evolution_diversity():
    return render_template("subjects/biology/evolution_diversity.html")

@app.route("/study/biology/ecology_biosphere_dynamics")
@login_required
def ecology_biosphere_dynamics():
    return render_template("subjects/biology/ecology_biosphere_dynamics.html")

@app.route("/study/biology/biochemistry_macromolecules")
@login_required
def biochemistry_macromolecules():
    return render_template("subjects/biology/biochemistry_macromolecules.html")

@app.route("/study/biology/cellular_respiration")
@login_required
def cellular_respiration():
    return render_template("subjects/biology/cellular_respiration.html")

@app.route("/study/biology/photosynthesis")
@login_required
def photosynthesis():
    return render_template("subjects/biology/photosynthesis.html")

@app.route("/study/biology/cell_cycle_division")
@login_required
def cell_cycle_division():
    return render_template("subjects/biology/cell_cycle_division.html")

@app.route("/study/biology/mendelian_genetics")
@login_required
def mendelian_genetics():
    return render_template("subjects/biology/mendelian_genetics.html")

@app.route("/study/biology/human_nervous_system")
@login_required
def human_nervous_system():
    return render_template("subjects/biology/human_nervous_system.html")

@app.route("/study/biology/immunology_defense")
@login_required
def immunology_defense():
    return render_template("subjects/biology/immunology_defense.html")

@app.route("/study/biology/endocrine_homeostasis")
@login_required
def endocrine_homeostasis():
    return render_template("subjects/biology/endocrine_homeostasis.html")

@app.route("/study/biology/cardiorespiratory_physiology")
@login_required
def cardiorespiratory_physiology():
    return render_template("subjects/biology/cardiorespiratory_physiology.html")

@app.route("/study/biology/plant_biology_anatomy")
@login_required
def plant_biology_anatomy():
    return render_template("subjects/biology/plant_biology_anatomy.html")

@app.route("/study/biology/biotechnology_genomics")
@login_required
def biotechnology_genomics():
    return render_template("subjects/biology/biotechnology_genomics.html")

# ==========================================
#  English
# ==========================================

@app.route("/study/english")
@login_required
def english_page():
    return render_template("subjects/english.html")

@app.route("/study/english/nouns_pronouns")
@login_required
def nouns_pronouns():
    return render_template("subjects/english/nouns_pronouns.html")

@app.route("/study/english/verbs_tenses")
@login_required
def verbs_tenses():
    return render_template("subjects/english/verbs_tenses.html")

@app.route("/study/english/adjectives_adverbs")
@login_required
def adjectives_adverbs():
    return render_template("subjects/english/adjectives_adverbs.html")

@app.route("/study/english/prepositions_conjunctions")
@login_required
def prepositions_conjunctions():
    return render_template("subjects/english/prepositions_conjunctions.html")

@app.route("/study/english/phrases_clauses")
@login_required
def phrases_clauses():
    return render_template("subjects/english/phrases_clauses.html")

@app.route("/study/english/lexis_semantics")
@login_required
def lexis_semantics():
    return render_template("subjects/english/lexis_semantics.html")

@app.route("/study/english/idioms_figures")
@login_required
def idioms_figures():
    return render_template("subjects/english/idioms_figures.html")

@app.route("/study/english/sentence_interpretation")
@login_required
def sentence_interpretation():
    return render_template("subjects/english/sentence_interpretation.html")

@app.route("/study/english/question_tag_punctuation")
@login_required
def question_tag_punctuation():
    return render_template("subjects/english/question_tag_punctuation.html")

@app.route("/study/english/comprehension_summary")
@login_required
def comprehension_summary():
    return render_template("subjects/english/comprehension_summary.html")


@app.route('/register', methods=['GET', 'POST'])
def register_page():
    form = RegisterForm()
    if form.validate_on_submit():
        user_to_create = User(username=form.username.data,
                              email_address=form.email_address.data,
                              password=form.password1.data)
        db.session.add(user_to_create)
        db.session.commit()
        login_user(user_to_create)
        flash(f"Account created successfully! You are now logged in as {user_to_create.username}", category='success')
        return redirect(url_for("home"))
    if form.errors != {}: #If there are not errors from the validations
        for err_msg in form.errors.values():
            flash(f'There was an error with creating a user: {err_msg}', category='danger')

    return render_template('register.html', form=form)

@app.route('/login', methods=['GET', 'POST'])
def login_page():
    form = LoginForm()
    if form.validate_on_submit():
        attempted_user = User.query.filter_by(username=form.username.data).first()
        if attempted_user and attempted_user.check_password_correction(
                attempted_password=form.password.data
        ):
            login_user(attempted_user, remember=True)
            flash(f'Success! You are logged in as: {attempted_user.username}', category='success')
            return redirect(url_for('home'))
        else:
            flash('Username and password are not match! Please try again', category='danger')

    return render_template('login.html', form=form)

@app.route("/logout")
@login_required
def logout_page():
    logout_user()
    flash("You have been logged out!", "info")
    return redirect(url_for("home"))
