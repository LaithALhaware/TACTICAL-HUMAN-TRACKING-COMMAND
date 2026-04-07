from flask import request, session, redirect, url_for

USERS = {"admin":"admin123"}

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("user"):
            return redirect("/login")
        return f(*args, **kwargs)
    return decorated

def login(username, password):
    if USERS.get(username) == password:
        session["user"] = username
        return True
    return False

def logout():
    session.pop("user", None)